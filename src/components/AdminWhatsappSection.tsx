import type { User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  deleteWhatsappGruppo,
  fetchWhatsappAutorizzazioniMap,
  fetchWhatsappGruppi,
  getAdminConfig,
  saveWhatsappGruppo,
  type CandidaturaRecord,
  type WhatsappAutorizzazioneRecord,
  type WhatsappGruppoCategoria,
  type WhatsappGruppoRecord,
} from '../lib/firestore';
import { parseFirestoreUiError } from '../lib/notifications';

interface AdminWhatsappSectionProps {
  adminUser: User;
  candidature: CandidaturaRecord[];
}

export function AdminWhatsappSection({ adminUser, candidature }: AdminWhatsappSectionProps) {
  const [loading, setLoading] = useState(true);
  const [gruppi, setGruppi] = useState<WhatsappGruppoRecord[]>([]);
  const [authMap, setAuthMap] = useState<Record<string, WhatsappAutorizzazioneRecord>>({});
  const [privateOfficialLink, setPrivateOfficialLink] = useState<string>('');
  const [revealPrivateLink, setRevealPrivateLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add/Edit Group Form
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<WhatsappGruppoCategoria>('UFFICIALE');
  const [descrizione, setDescrizione] = useState('');
  const [squadraAssociata, setSquadraAssociata] = useState('');
  const [linkInvito, setLinkInvito] = useState('');
  const [attivo, setAttivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gList, aMap, adminCfg] = await Promise.all([
        fetchWhatsappGruppi(),
        fetchWhatsappAutorizzazioniMap(),
        getAdminConfig().catch(() => null),
      ]);
      setGruppi(gList);
      setAuthMap(aMap);
      setPrivateOfficialLink(adminCfg?.linkWhatsappUfficiale ?? '');
    } catch (err) {
      setError(parseFirestoreUiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const resetForm = () => {
    setEditingId(undefined);
    setNome('');
    setCategoria('UFFICIALE');
    setDescrizione('');
    setSquadraAssociata('');
    setLinkInvito('');
    setAttivo(true);
  };

  const handleSaveGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminUser.email) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await saveWhatsappGruppo({
        id: editingId,
        nome,
        categoria,
        descrizione,
        squadraAssociata,
        linkInvito,
        attivo,
        adminEmail: adminUser.email,
      });
      setSuccessMsg(
        editingId
          ? 'Gruppo WhatsApp aggiornato correttamente su Firestore.'
          : 'Nuovo gruppo WhatsApp registrato in whatsapp_gruppi.'
      );
      resetForm();
      await loadAll();
    } catch (err) {
      setError(parseFirestoreUiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (g: WhatsappGruppoRecord) => {
    if (!adminUser.email) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await saveWhatsappGruppo({
        id: g.id,
        nome: g.nome,
        categoria: g.categoria,
        descrizione: g.descrizione,
        squadraAssociata: g.squadraAssociata,
        linkInvito: g.linkInvito,
        attivo: !g.attivo,
        adminEmail: adminUser.email,
      });
      await loadAll();
    } catch (err) {
      setError(parseFirestoreUiError(err));
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      await deleteWhatsappGruppo(id);
      setSuccessMsg('Gruppo WhatsApp rimosso da whatsapp_gruppi.');
      if (editingId === id) resetForm();
      await loadAll();
    } catch (err) {
      setError(parseFirestoreUiError(err));
    }
  };

  const authorizedCount = Object.values(authMap).filter(
    (a) => a.statoAutorizzazione === 'AUTORIZZATO'
  ).length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
            Sicurezza link ufficiali · Accesso riservato staff
          </p>
          <h2 className="mt-0.5 font-display text-xl font-extrabold text-[#0B1F4D]">
            GESTIONE ACCESSI WHATSAPP
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Configura i gruppi WhatsApp ufficiali o di categoria e monitora le autorizzazioni per ogni candidato. I link ufficiali non sono mai accessibili senza autenticazione.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Aggiorna</span>
        </button>
      </div>

      {/* Private Config Sync Notice */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-[#0B1F4D]">
            <Lock className="w-4 h-4 text-[#C69214]" />
            <span>Link ufficiale principale (configurazione/private)</span>
          </div>
          <p className="text-xs text-slate-600 font-mono-tabular break-all">
            {privateOfficialLink
              ? revealPrivateLink
                ? privateOfficialLink
                : 'Configurato e protetto (clicca Mostra per visualizzarlo)'
              : 'Non ancora salvato in configurazione/private (impostabile dalla scheda Configurazione)'}
          </p>
        </div>
        {privateOfficialLink && (
          <button
            type="button"
            onClick={() => setRevealPrivateLink((p) => !p)}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-[#0B1F4D] hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {revealPrivateLink ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{revealPrivateLink ? 'Nascondi link' : 'Mostra link'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-2.5 text-xs sm:text-sm text-red-900">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-2.5 text-xs sm:text-sm text-emerald-900">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form aggiungi/modifica gruppo */}
        <form
          onSubmit={handleSaveGroup}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#0B1F4D] inline-flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#C69214]" />
              <span>{editingId ? 'Modifica gruppo WhatsApp' : 'Aggiungi gruppo WhatsApp'}</span>
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-slate-500 hover:text-[#0B1F4D] cursor-pointer"
              >
                Annulla modifica
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome gruppo *
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. FICUP Ufficiale"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria *</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as WhatsappGruppoCategoria)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="UFFICIALE">UFFICIALE</option>
                <option value="CATEGORIA">CATEGORIA</option>
                <option value="PROVVISORIO">PROVVISORIO</option>
                <option value="ALTRO">ALTRO</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Squadra / Girone associato
              </label>
              <input
                type="text"
                maxLength={100}
                value={squadraAssociata}
                onChange={(e) => setSquadraAssociata(e.target.value)}
                placeholder="Opzionale"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Link invito WhatsApp *
            </label>
            <input
              type="url"
              required
              maxLength={300}
              value={linkInvito}
              onChange={(e) => setLinkInvito(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Descrizione</label>
            <textarea
              rows={2}
              maxLength={400}
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Note operative per lo staff..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-800">
            <input
              type="checkbox"
              checked={attivo}
              onChange={(e) => setAttivo(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#0B1F4D]"
            />
            <span>Gruppo attivo e selezionabile per le autorizzazioni</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] w-full px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{editingId ? 'Salva modifiche gruppo' : 'Registra gruppo WhatsApp'}</span>
          </button>
        </form>

        {/* Elenco gruppi configurati + Stato autorizzazioni candidati */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-[#0B1F4D]">
              Gruppi configurati ({gruppi.length})
            </h3>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Caricamento gruppi WhatsApp...</span>
              </div>
            ) : gruppi.length === 0 ? (
              <p className="text-xs sm:text-sm text-slate-500">
                Nessun gruppo aggiuntivo configurato in <span className="font-mono-tabular">whatsapp_gruppi</span>.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                {gruppi.map((g) => (
                  <div key={g.id} className="p-3.5 sm:p-4 space-y-2 text-xs sm:text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="font-bold text-[#0B1F4D]">{g.nome}</span>
                        <span className="font-mono-tabular text-[11px] text-slate-500">
                          · {g.categoria}
                        </span>
                      </div>
                      <span
                        className={`font-mono-tabular text-[11px] font-bold ${
                          g.attivo ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {g.attivo ? 'ATTIVO' : 'DISATTIVATO'}
                      </span>
                    </div>
                    {g.squadraAssociata && (
                      <p className="text-xs text-slate-600">
                        Associato a: <strong>{g.squadraAssociata}</strong>
                      </p>
                    )}
                    {g.descrizione && (
                      <p className="text-xs text-slate-600">{g.descrizione}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(g.id);
                          setNome(g.nome);
                          setCategoria(g.categoria);
                          setDescrizione(g.descrizione);
                          setSquadraAssociata(g.squadraAssociata);
                          setLinkInvito(g.linkInvito);
                          setAttivo(g.attivo);
                        }}
                        className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-[#0B1F4D] hover:bg-slate-50 cursor-pointer"
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(g)}
                        className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {g.attivo ? 'Disattiva' : 'Attiva'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(g.id)}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Elimina</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[#0B1F4D]">
                Riepilogo autorizzazioni candidati
              </h3>
              <span className="font-mono-tabular text-xs font-bold text-emerald-700">
                {authorizedCount} autorizzati
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Puoi impostare l&apos;autorizzazione WhatsApp e il gruppo assegnato aprendo i <strong>DETTAGLI</strong> di ogni candidatura dalla scheda Candidature.
            </p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-64 overflow-y-auto">
              {candidature.length === 0 ? (
                <p className="p-3.5 text-xs text-slate-500">Nessuna candidatura presente.</p>
              ) : (
                candidature.slice(0, 25).map((c) => {
                  const auth = authMap[c.id];
                  return (
                    <div
                      key={c.id}
                      className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-mono-tabular font-bold text-[#0B1F4D] mr-2">
                          {c.codiceCandidatura}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {c.nome} {c.cognome}
                        </span>
                      </div>
                      <span
                        className={`font-mono-tabular font-semibold ${
                          auth?.statoAutorizzazione === 'AUTORIZZATO'
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {auth ? auth.statoAutorizzazione : c.stato === 'COMPLETATO' ? 'SBLOCCATO (stato COMPLETATO)' : 'NON AUTORIZZATO'}
                        {auth?.gruppoNome ? ` · ${auth.gruppoNome}` : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
