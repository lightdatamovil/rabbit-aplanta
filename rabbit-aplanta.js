import { connect } from 'amqplib';
import dotenv from 'dotenv';
import { aplanta } from './controller/aplantaController.js';
import { verifyParameters } from './src/funciones/verifyParameters.js';
import { getCompanyById, redisClient } from './db.js';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME_COLECTA = process.env.QUEUE_NAME_COLECTA;;

async function startConsumer() {
    try {
        await redisClient.connect();

        const connection = await connect(RABBITMQ_URL);

        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME_COLECTA, { durable: true });

        console.log(`[*] Esperando mensajes en la cola "${QUEUE_NAME_COLECTA}"`);

        channel.consume(QUEUE_NAME_COLECTA, async (msg) => {
                 const start = process.hrtime();
            if (msg !== null) {
                const body = JSON.parse(msg.content.toString());
                try {
                    console.log("[x] Mensaje recibido:", body);

                    const errorMessage = verifyParameters(body, ['dataQr', 'channel']);

                    if (errorMessage) {
                        console.log("[x] Error al verificar los parámetros:", errorMessage);
                        return { mensaje: errorMessage };
                    }
                    const company = await getCompanyById(body.companyId);
                    console.log("companyque llega", company.did);

                    const result = await aplanta(company, body.dataQr, body.userId);

                    result.feature = "colecta";

                    channel.sendToQueue(body.channel, Buffer.from(JSON.stringify(result)), { persistent: true });
                 //   console.timeEnd("Tiempo de ejecución");
                    console.log(
                        "[x] Mensaje enviado al canal",
                        body.channel + ":",
                        result
                    );

                } catch (error) {
                    console.error("[x] Error al procesar el mensaje:", error);

                    let a = channel.sendToQueue(
                        body.channel,
                        Buffer.from(JSON.stringify({ feature: body.feature, estadoRespuesta: false, mensaje: error.message })),
                        { persistent: true }
                    );

                    if (a) {
                        console.log("Mensaje enviado al canal", body.channel + ":", { feature: body.feature, estadoRespuesta: false, mensaje: error.message });
                    }
                    const elapsed = process.hrtime(start);
                    const seconds = elapsed[0];
                    const nanoseconds = elapsed[1];
                    const milliseconds = (seconds * 1000 + nanoseconds / 1e6).toFixed(3);

                    console.log(`[x] Tiempo de ejecución: ${milliseconds}ms`);
                } finally {
                    channel.ack(msg);
                }
            }
        });
    } catch (error) {
        console.error('❌ Error al conectar con RabbitMQ:', error);
    }
}

startConsumer();
