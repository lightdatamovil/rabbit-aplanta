import { executeQuery } from '../../db.js';
import { logRed } from './logsCustom.js';
export async function crearLog(idEmpresa, operador, shipmentId, endpoint, result, quien, conLocal, errors, tiempo, idDispositivo, modelo, marca, versionAndroid, versionApp) {
    if (shipmentId == null || shipmentId == undefined) {
        shipmentId = 0
    }

    try {
        const fechaunix = Date.now();
        const sqlLog = `INSERT INTO logs (didempresa, didEnvio, fechaunix, quien, cadete, data, procesado, tiempo, error) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [idEmpresa, shipmentId, fechaunix, quien, operador, JSON.stringify(result), endpoint, tiempo, errors];

        await executeQuery(conLocal, sqlLog, values);

    } catch (error) {
        logRed.error(`Error al crear el log: ${error.stack}`);
        throw error;
    }
}
