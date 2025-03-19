import { executeQuery, getClientsByCompany, getDriversByCompany } from "../../../db.js";
import { logCyan, logRed, logYellow } from "../../../src/funciones/logsCustom.js";

export async function informe(dbConnection, companyId, clientId, userId, shipmentId) {
    try {
        
  
        return {
            cliente:"sininfo" ,
            aingresarhoy: "sininfo",
            ingresadoshot:"sininfo" ,
            ingresadosahora:"sininfo" ,
            chofer:"sininfo" ,
            zonaentrega:"sininfo" ,
            sucursal: "sininfo"
        };

    } catch (error) {
        logRed(`Error en informe: ${error.stack}`);
        throw error;
    }
}
