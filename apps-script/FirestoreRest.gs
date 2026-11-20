/**
 * FICUP 26/27 - Backend (Google Apps Script)
 * File: FirestoreRest.gs
 *
 * Client Firestore REST API v1 autenticato.
 * Supporta:
 * 1) OAuth nativo dello script collegato al GCP Project candidature-ficup (ScriptApp.getOAuthToken)
 * 2) Service Account JSON opzionale salvato esclusivamente in ScriptProperties (FIREBASE_SERVICE_ACCOUNT_JSON)
 */

function getFirestoreAccessToken_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('ficup_fs_sa_token');
  if (cached) {
    return cached;
  }

  var saJson = PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (saJson && saJson.trim()) {
    var token = fetchServiceAccountAccessToken_(JSON.parse(saJson));
    cache.put('ficup_fs_sa_token', token, 3000); // ~50 minuti
    return token;
  }

  // Fallback predefinito: OAuth già collegato al progetto GCP candidature-ficup
  return ScriptApp.getOAuthToken();
}

function base64UrlEncode_(input) {
  var bytes = typeof input === 'string' ? Utilities.newBlob(input).getBytes() : input;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function fetchServiceAccountAccessToken_(sa) {
  var now = Math.floor(Date.now() / 1000);
  var header = base64UrlEncode_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claimSet = base64UrlEncode_(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })
  );
  var toSign = header + '.' + claimSet;
  var signatureBytes = Utilities.computeRsaSha256Signature(toSign, sa.private_key);
  var jwt = toSign + '.' + base64UrlEncode_(signatureBytes);

  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var body = JSON.parse(resp.getContentText() || '{}');
  if (code < 200 || code >= 300 || !body.access_token) {
    throw new Error('Errore acquisizione token Service Account (' + code + '): ' + (body.error_description || body.error || 'Sconosciuto'));
  }
  return body.access_token;
}

function firestoreRequest_(url, method, payloadObj) {
  var token = getFirestoreAccessToken_();
  var options = {
    method: method,
    headers: {
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  };

  if (payloadObj !== undefined && payloadObj !== null) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payloadObj);
  }

  var resp = UrlFetchApp.fetch(url, options);
  var status = resp.getResponseCode();
  var raw = resp.getContentText() || '';
  var parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (e) {
    parsed = null;
  }

  return { status: status, data: parsed, raw: raw };
}

function fsGetDocument_(collectionName, docId) {
  var url =
    getFirestoreBaseUrl_() +
    '/' +
    encodeURIComponent(collectionName) +
    '/' +
    encodeURIComponent(docId);

  var res = firestoreRequest_(url, 'get', null);
  if (res.status === 404) {
    return null;
  }
  if (res.status < 200 || res.status >= 300 || !res.data) {
    throw new Error('Firestore GET ' + collectionName + '/' + docId + ' HTTP ' + res.status + ': ' + res.raw);
  }
  return fromFirestoreDoc_(res.data);
}

/**
 * Legge un documento usando direttamente il Firebase ID Token del chiamante.
 * Consente a Firestore stesso di verificare firma RS256, scadenza e regole isAdmin().
 */
function fsGetDocumentWithUserToken_(collectionName, docId, firebaseIdToken) {
  var url =
    getFirestoreBaseUrl_() +
    '/' +
    encodeURIComponent(collectionName) +
    '/' +
    encodeURIComponent(docId);

  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + firebaseIdToken
    },
    muteHttpExceptions: true
  });

  var status = resp.getResponseCode();
  var raw = resp.getContentText() || '';
  if (status === 401 || status === 403) {
    return { authorized: false, status: status, doc: null };
  }
  if (status === 404) {
    return { authorized: true, status: 404, doc: null };
  }
  if (status < 200 || status >= 300) {
    throw new Error('Firestore user GET ' + collectionName + '/' + docId + ' HTTP ' + status + ': ' + raw);
  }
  var parsed = JSON.parse(raw);
  return { authorized: true, status: status, doc: fromFirestoreDoc_(parsed) };
}

/**
 * Crea il documento SOLO se non esiste già (precondizione lato server currentDocument.exists=false).
 * Restituisce true se creato, false se già esistente (HTTP 409).
 */
function fsCreateDocumentIfAbsent_(collectionName, docId, plainObj) {
  var url =
    getFirestoreBaseUrl_() +
    '/' +
    encodeURIComponent(collectionName) +
    '?documentId=' +
    encodeURIComponent(docId);

  var res = firestoreRequest_(url, 'post', {
    fields: toFirestoreFields_(plainObj)
  });

  if (res.status === 409) {
    return false;
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error('Firestore CREATE ' + collectionName + '/' + docId + ' HTTP ' + res.status + ': ' + res.raw);
  }
  return true;
}

function fsCreateAutoDocument_(collectionName, plainObj) {
  var url =
    getFirestoreBaseUrl_() +
    '/' +
    encodeURIComponent(collectionName);

  var res = firestoreRequest_(url, 'post', {
    fields: toFirestoreFields_(plainObj)
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error('Firestore AUTO CREATE ' + collectionName + ' HTTP ' + res.status + ': ' + res.raw);
  }
  return res.data ? fromFirestoreDoc_(res.data) : null;
}

function fsPatchDocument_(collectionName, docId, partialObj) {
  var keys = Object.keys(partialObj);
  var maskParams = keys
    .map(function (k) {
      return 'updateMask.fieldPaths=' + encodeURIComponent(k);
    })
    .join('&');

  var url =
    getFirestoreBaseUrl_() +
    '/' +
    encodeURIComponent(collectionName) +
    '/' +
    encodeURIComponent(docId) +
    '?' +
    maskParams;

  var res = firestoreRequest_(url, 'patch', {
    fields: toFirestoreFields_(partialObj)
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error('Firestore PATCH ' + collectionName + '/' + docId + ' HTTP ' + res.status + ': ' + res.raw);
  }
  return res.data ? fromFirestoreDoc_(res.data) : null;
}

/**
 * Aggiorna il documento con controllo ottimistico sulla versione (currentDocument.updateTime)
 * per evitare di sovrascrivere modifiche manuali effettuate contemporaneamente da un admin.
 */
function fsPatchDocumentIfUnmodified_(collectionName, docId, partialObj, expectedUpdateTime) {
  var keys = Object.keys(partialObj);
  var params = keys.map(function (k) {
    return 'updateMask.fieldPaths=' + encodeURIComponent(k);
  });

  if (expectedUpdateTime) {
    params.push('currentDocument.updateTime=' + encodeURIComponent(String(expectedUpdateTime)));
  } else {
    params.push('currentDocument.exists=true');
  }

  var url =
    getFirestoreBaseUrl_() +
    '/' +
    encodeURIComponent(collectionName) +
    '/' +
    encodeURIComponent(docId) +
    '?' +
    params.join('&');

  var res = firestoreRequest_(url, 'patch', {
    fields: toFirestoreFields_(partialObj)
  });

  if (res.status === 400 || res.status === 404 || res.status === 409 || res.status === 412) {
    return {
      updated: false,
      conflict: true,
      status: res.status,
      raw: res.raw,
      doc: null
    };
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error('Firestore CONDITIONAL PATCH ' + collectionName + '/' + docId + ' HTTP ' + res.status + ': ' + res.raw);
  }
  return {
    updated: true,
    conflict: false,
    status: res.status,
    raw: res.raw,
    doc: res.data ? fromFirestoreDoc_(res.data) : null
  };
}

function fsRunQuery_(structuredQuery) {
  var res = firestoreRequest_(getFirestoreRunQueryUrl_(), 'post', {
    structuredQuery: structuredQuery
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error('Firestore runQuery HTTP ' + res.status + ': ' + res.raw);
  }

  var rows = Array.isArray(res.data) ? res.data : [];
  var docs = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].document) {
      docs.push(fromFirestoreDoc_(rows[i].document));
    }
  }
  return docs;
}

function toFirestoreValue_(val) {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Math.floor(val) === val) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue_)
      }
    };
  }
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: toFirestoreFields_(val)
      }
    };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields_(obj) {
  var fields = {};
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj[k] !== undefined) {
      fields[k] = toFirestoreValue_(obj[k]);
    }
  }
  return fields;
}

function fromFirestoreValue_(typed) {
  if (!typed || typeof typed !== 'object') {
    return null;
  }
  if ('stringValue' in typed) return typed.stringValue;
  if ('booleanValue' in typed) return typed.booleanValue;
  if ('integerValue' in typed) return Number(typed.integerValue);
  if ('doubleValue' in typed) return Number(typed.doubleValue);
  if ('timestampValue' in typed) return typed.timestampValue;
  if ('nullValue' in typed) return null;
  if ('arrayValue' in typed) {
    var values = (typed.arrayValue && typed.arrayValue.values) || [];
    return values.map(fromFirestoreValue_);
  }
  if ('mapValue' in typed) {
    var subFields = (typed.mapValue && typed.mapValue.fields) || {};
    var out = {};
    var keys = Object.keys(subFields);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = fromFirestoreValue_(subFields[keys[i]]);
    }
    return out;
  }
  return null;
}

function fromFirestoreDoc_(doc) {
  var nameParts = (doc.name || '').split('/');
  var id = nameParts.length > 0 ? nameParts[nameParts.length - 1] : '';
  var out = { id: id, _updateTime: doc.updateTime || '' };
  var fields = doc.fields || {};
  var keys = Object.keys(fields);
  for (var i = 0; i < keys.length; i++) {
    out[keys[i]] = fromFirestoreValue_(fields[keys[i]]);
  }
  return out;
}
