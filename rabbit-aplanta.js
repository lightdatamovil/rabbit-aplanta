import { connect } from 'amqplib';
import dotenv from 'dotenv';
import { aplanta } from './controller/aplantaController.js';
import { verifyParameters } from './src/funciones/verifyParameters.js';
import { getCompanyById, redisClient } from './db.js';
import { logBlue, logGreen, logRed } from './src/funciones/logsCustom.js';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME_COLECTA = process.env.QUEUE_NAME_COLECTA;;

async function startConsumer() {
    try {
        await redisClient.connect();

        const connection = await connect(RABBITMQ_URL);

        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME_COLECTA, { durable: true });

        logBlue(`Esperando mensajes en la cola "${QUEUE_NAME_COLECTA}"`);

        channel.consume(QUEUE_NAME_COLECTA, async (msg) => {
            console.time("Tiempo de ejecución");
            if (msg !== null) {
                const body = JSON.parse(msg.content.toString());
                try {
                    logGreen("[x] Mensaje recibido:", body);

                    const errorMessage = verifyParameters(body, ['dataQr', 'channel']);

                    if (errorMessage) {
                        logRed("[x] Error al verificar los parámetros:", errorMessage);
                        throw new Error(errorMessage);
                    }
                    const company = await getCompanyById(body.companyId);

                    const result = await aplanta(company, body.dataQr, body.userId);

                    result.feature = "aplanta";

                    channel.sendToQueue(body.channel, Buffer.from(JSON.stringify(result)), { persistent: true });

                    logGreen(
                        "Mensaje enviado al canal",
                        body.channel + ":",
                        result
                    );

                    console.timeEnd("Tiempo de ejecución");

                } catch (error) {
                    logRed("Error al procesar el mensaje:", error);

                    let a = channel.sendToQueue(
                        body.channel,
                        Buffer.from(JSON.stringify({ feature: body.feature, estadoRespuesta: false, mensaje: error.message })),
                        { persistent: true }
                    );

                    if (a) {
                        logGreen("Mensaje enviado al canal", body.channel + ":", { feature: body.feature, estadoRespuesta: false, mensaje: error.message });
                    }
                    console.timeEnd("Tiempo de ejecución");
                } finally {
                    channel.ack(msg);
                }
            }
        });
    } catch (error) {
        logRed('Error al conectar con RabbitMQ:', error);
    }
}

startConsumer();
