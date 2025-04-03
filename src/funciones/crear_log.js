import { executeQuery } from '../../db.js';
import { logRed } from './logsCustom.js';
export async function crearLog(idEmpresa, operador, shipmentId, endpoint, result, quien, conLocal, errors, idDispositivo, modelo, marca, versionAndroid, versionApp) {
    if (shipmentId == null || shipmentId == undefined) {
        shipmentId = 0
    }

    try {
        const fechaunix = Date.now();
        const sqlLog = `INSERT INTO logs (didempresa,didEnvio, quien, cadete, data, fechaunix,procesado,error) VALUES (?,?, ?, ?, ?, ?, ?,?)`;

        const values = [idEmpresa, shipmentId, quien, operador, JSON.stringify(result), fechaunix, endpoint, errors];

        await executeQuery(conLocal, sqlLog, values);

    } catch (error) {
        logRed.error(`Error al crear el log: ${error.stack}`);
        throw error;
    }
}
