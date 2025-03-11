import { executeQuery } from "../../../../db.js";

import { insertEnvios } from "../../functions/insertEnvios.js";
import { updateLastShipmentState } from "../../functions/updateLastShipmentState.js";
import { sendToShipmentStateMicroService } from "../../functions/sendToShipmentStateMicroService.js";
import { checkearEstadoEnvio } from "../../functions/checkarEstadoEnvio.js";
import { informe } from "../../functions/informe.js";

/// Busco el envio
/// Si no existe, lo inserto y tomo el did
/// Checkeo si el envío ya fue colectado cancelado o entregado
/// Actualizo el estado del envío y lo envío al microservicio de estados
/// Asigno el envío al usuario si es necesario
export async function handleInternalFlex(dbConnection, companyId, userId, dataQr, account) {
    const senderId = dataQr.sender_id;
    const mlShipmentId = dataQr.id;

    let shipmentId;

    /// Busco el envio
    const sql = `
        SELECT did
        FROM envios 
        WHERE ml_shipment_id = ? AND ml_vendedor_id = ? 
        LIMIT 1
    `;

    let resultBuscarEnvio = await executeQuery(dbConnection, sql, [mlShipmentId, senderId]);

    /// Si no existe, lo inserto y tomo el did
    if (resultBuscarEnvio.length === 0) {
        shipmentId = await insertEnvios(dbConnection, companyId, account.didCliente, account.didCuenta, dataQr, 1, 0);
        resultBuscarEnvio = await executeQuery(dbConnection, sql, [mlShipmentId, senderId]);
    }
    const row = resultBuscarEnvio[0];

    shipmentId = row.did;

    /// Checkeo si el envío ya fue colectado cancelado o entregado
    const check = await checkearEstadoEnvio(dbConnection, shipmentId);
    if (check) return check;

    const queryUpdateEnvios = `
                UPDATE envios 
                SET ml_qr_seguridad = ?
                WHERE superado = 0 AND elim = 0 AND did = ?
                LIMIT 1
            `;

    await executeQuery(dbConnection, queryUpdateEnvios, [JSON.stringify(dataQr), shipmentId]);

    /// Actualizo el estado del envío y lo envío al microservicio de estados
    await updateLastShipmentState(dbConnection, shipmentId);
    await sendToShipmentStateMicroService(companyId, userId, shipmentId);

    const body = await informe(dbConnection, companyId, client, userId, shipmentId);
    return { estadoRespuesta: true, mensaje: "Paquete insertado y puesto a planta  - FLEX", body: body };

}