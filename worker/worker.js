import { parentPort } from 'worker_threads';
import { aplanta } from '../controller/aplantaController.js';
import { getCompanyById } from '../db.js';
import { logGreen, logRed, logPurple } from '../src/funciones/logsCustom.js';

parentPort.on('message', async (msg) => {
  const startTime = performance.now();
  try {
    logGreen(`Procesando mensaje en worker: ${JSON.stringify(msg)}`);

    const company = await getCompanyById(msg.companyId);
    const result = await aplanta(company, msg.dataQr, msg.userId);

    result.feature = 'aplanta';
    parentPort.postMessage({ result, channel: msg.channel });

    const endTime = performance.now();
    logPurple(`Tiempo de ejecución en worker: ${endTime - startTime} ms`);
  } catch (error) {
    logRed(`Error en worker: ${error.stack}`);
    parentPort.postMessage({ error: error.stack, channel: msg.channel });
  }
});
