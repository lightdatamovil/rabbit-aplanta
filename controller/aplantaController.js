import { getAccountBySenderId, getLocalDbConfig, getProdDbConfig } from "../db.js";
import { handleInternalFlex } from "./controller/handlers/flex/handleInternalFlex.js";
import { handleExternalFlex } from "./controller/handlers/flex/handleExternalFlex.js";
import { handleExternalNoFlex } from "./controller/handlers/noflex/handleExternalNoFlex.js";
import { handleInternalNoFlex } from "./controller/handlers/noflex/handleInternalNoFlex.js";
import mysql from "mysql";
import { logCyan, logRed } from "../src/funciones/logsCustom.js";
import { crearLog } from "../src/funciones/crear_log.js";


export async function aplanta(company, body) {
    const startTime = performance.now();
    const dbConfig = getProdDbConfig(company);
    const dbConnection = mysql.createConnection(dbConfig);
    dbConnection.connect();

    const dbConfigLocal = getLocalDbConfig();
    const dbConnectionLocal = mysql.createConnection(dbConfigLocal);
    dbConnectionLocal.connect();

    try {
        let response;
        const dataQr = body.dataQr;
        const userId = body.userId;

        const isFlex = dataQr.hasOwnProperty("sender_id");

        if (isFlex) {
            logCyan("Es flex");
            const account = await getAccountBySenderId(dbConnection, company.did, dataQr.sender_id);

            if (account) {
                logCyan("Es interno");
                response = await handleInternalFlex(dbConnection, company.did, userId, dataQr, account);
            } else {
                logCyan("Es externo");
                response = await handleExternalFlex(dbConnection, company.did, dataQr, userId);
            }
        } else {
            logCyan("No es flex");
            if (company.did == dataQr.empresa) {
                logCyan("Es externo");
                response = await handleInternalNoFlex(dbConnection, dataQr, company.did, userId);
            } else {
                logCyan("Es interno");
                response = await handleExternalNoFlex(dbConnection, dataQr, company.did, userId);
            }
        }
        const endTime = performance.now();
        const tiempo = endTime - startTime;
        crearLog(dbConnectionLocal, company.did, userId, body.profile, body, tiempo, response, "rabbit", true);
        return response;
    } catch (error) {
        const endTime = performance.now();
        const tiempo = endTime - startTime;
        crearLog(dbConnectionLocal, company.did, userId, body.profile, body, tiempo, response, "rabbit", true);
        logRed(`Error en poner a planta: ${error.stack}`)
        throw error;
    } finally {
        dbConnection.end();
        dbConnectionLocal.end();
    }
}
