import { executeQuery, getClientsByCompany, getDriversByCompany } from "../../../db.js";
import { logCyan, logPurple, logRed, logYellow } from "../../../src/funciones/logsCustom.js";
const contadoresIngresados = {};

export async function informe(dbConnection, companyId, clientId, userId, shipmentId) {
    const hoy = new Date().toISOString().split('T')[0];

    try {
        const queryIngresadosHoy = `
            SELECT eh.estado 
            FROM envios_historial AS eh
            JOIN envios AS e 
                ON e.elim=0 AND e.superado=0 AND e.didCliente = ? AND e.did = eh.didEnvio
            WHERE eh.elim=0 AND eh.superado=0 
            AND (eh.autofecha BETWEEN ? AND ?) 
            AND eh.estado IN (7, 0, 1);
        `;

        const resultIngresadosHoy = await executeQuery(dbConnection, queryIngresadosHoy, [clientId, `${hoy} 00:00:00`, `${hoy} 23:59:59`]);

        let amountOfAPlanta = 1;
        let amountOfARetirarAndRetirados = 0;

        resultIngresadosHoy.forEach(row => {
            if (row.estado === 1) {
                amountOfARetirarAndRetirados++;
            } else {
                amountOfAPlanta++;
            }
        });

        incrementarIngresados(hoy, companyId, userId);
        const ingresadosHoyChofer = obtenerIngresados(hoy, companyId, userId);

        let choferasignado;
        let zonaentrega;
        let sucursal = "Sin información";

        if (shipmentId > 0) {
            let tieneSucursalDistribucion = false;

            try {
                const columnas = await executeQuery(dbConnection, `SHOW COLUMNS FROM envios LIKE 'didSucursalDistribucion'`);
                tieneSucursalDistribucion = Array.isArray(columnas) && columnas.length > 0;
            } catch (e) {
                logRed("Error al verificar columna didSucursalDistribucion: " + e.message);
            }

            const queryEnvios = `
                SELECT 
                    ez.nombre AS zona, 
                    e.choferAsignado
                    ${tieneSucursalDistribucion ? ', sd.nombre AS sucursal' : ''}
                FROM envios AS e 
                LEFT JOIN envios_zonas AS ez 
                    ON ez.elim=0 AND ez.superado=0 AND ez.did = e.didEnvioZona
                    ${tieneSucursalDistribucion ? `
                LEFT JOIN sucursales_distribucion AS sd 
                    ON sd.elim=0 AND sd.superado=0 AND sd.did = e.didSucursalDistribucion` : ''}
                WHERE e.superado=0 AND e.elim=0 AND e.did = ?;
            `;

            const resultEnvios = await executeQuery(dbConnection, queryEnvios, [shipmentId]);

            if (Array.isArray(resultEnvios) && resultEnvios.length > 0) {
                const envio = resultEnvios[0];
                choferasignado = envio.choferAsignado || 'Sin asignar';
                zonaentrega = envio.zona || "Sin información";
                if (tieneSucursalDistribucion) {
                    sucursal = envio.sucursal || "Sin información";
                }
            }
        }

        const companyClients = await getClientsByCompany(dbConnection, companyId);
        const companyDrivers = await getDriversByCompany(dbConnection, companyId);

        if (companyClients[clientId] === undefined) {
            throw new Error("Cliente no encontrado");
        }
        logCyan("El cliente fue encontrado");

        const chofer = companyDrivers[choferasignado]?.nombre || "Sin información";
        if (!companyDrivers[choferasignado]) {
            logCyan("El chofer no fue encontrado");
        } else {
            logCyan("El chofer fue encontrado");
        }

        logCyan("Se generó el informe");

        return {
            cliente: companyClients[clientId]?.nombre || 'Sin información',
            aingresarhoy: amountOfAPlanta,
            ingresadoshot: amountOfARetirarAndRetirados,
            ingresadosahora: ingresadosHoyChofer,
            chofer,
            zonaentrega,
            sucursal
        };

    } catch (error) {
        logRed(`Error en informe: ${error.stack}`);
        throw error;
    }
}



function incrementarIngresados(fecha, empresa, chofer) {
    const clave = `${fecha}:${empresa}:${chofer}`;
    if (!contadoresIngresados[clave]) {
        contadoresIngresados[clave] = 0;
    }
    contadoresIngresados[clave]++;
}

// Función para obtener el total ingresado
function obtenerIngresados(fecha, empresa, chofer) {
    return contadoresIngresados[`${fecha}:${empresa}:${chofer}`] || 0;
}

function limpiarContadores() {
    logPurple("🔄 Reiniciando contadores de envíos ingresados...");
    Object.keys(contadoresIngresados).forEach(clave => delete contadoresIngresados[clave]);
}
setInterval(limpiarContadores, 14 * 24 * 60 * 60 * 1000);