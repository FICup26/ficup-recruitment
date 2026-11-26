import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { createOfficialApiApp } from './app';
import { DEFAULT_BRIDGE_SERVICE_ACCOUNT, FUNCTION_REGION } from './config';

setGlobalOptions({
  region: FUNCTION_REGION,
  maxInstances: 20,
});

const expressApp = createOfficialApiApp();

export const officialFicupApi = onRequest(
  {
    region: FUNCTION_REGION,
    serviceAccount: DEFAULT_BRIDGE_SERVICE_ACCOUNT,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  expressApp
);
