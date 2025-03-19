import { connect } from 'amqplib';
import dotenv from 'dotenv';
import { aplanta } from './controller/aplantaController.js';
import { verifyParameters } from './src/funciones/verifyParameters.js';
import { getCompanyById, redisClient } from './db.js';
import { logBlue, logGreen, logPurple, logRed } from './src/funciones/logsCustom.js';
import { Worker } from 'worker_threads'; // Importamos worker_threads

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME_COLECTA = process.env.QUEUE_NAME_COLECTA;

async function startConsumer() {
    try {
        await redisClient.connect();

        const connection = await connect(RABBITMQ_URL);

        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME_COLECTA, { durable: true });

        logBlue(`Esperando mensajes en la cola "${QUEUE_NAME_COLECTA}"`);

        channel.consume(QUEUE_NAME_COLECTA, async (msg) => {
            const startTime = performance.now();
            if (msg !== null) {
                const body = JSON.parse(msg.content.toString());
                try {
                    logGreen(`Mensaje recibido: ${JSON.stringify(body)}`);

                    const errorMessage = verifyParameters(body, ['dataQr', 'channel']);
                    if (errorMessage) {
                        logRed("Error al verificar los parámetros:", errorMessage);
                        throw new Error(errorMessage);
                    }

                    // En vez de procesar directamente, usamos un Worker thread
                    const worker = new Worker('./worker.js', { workerData: { body } });

                    worker.on('message', async (result) => {
                        try {
                            result.feature = "aplanta";
                            channel.sendToQueue(body.channel, Buffer.from(JSON.stringify(result)), { persistent: true });
                            logGreen(`Mensaje enviado al canal ${body.channel} : ${JSON.stringify(result)}`);
                        } catch (error) {
                            logRed(`Error al enviar mensaje al canal: ${error.stack}`);
                        }
                    });

                    worker.on('error', (error) => {
                        logRed(`Error en el worker: ${error.stack}`);
                    });

                    worker.on('exit', (code) => {
                        if (code !== 0) {
                            logRed(`El worker terminó con código ${code}`);
                        }
                    });

                    const endTime = performance.now();
                    logPurple(`Tiempo de ejecución del worker: ${endTime - startTime} ms`);

                } catch (error) {
                    logRed(`Error al procesar el mensaje: ${error.stack}`);

                    let a = channel.sendToQueue(
                        body.channel,
                        Buffer.from(JSON.stringify({ feature: body.feature, estadoRespuesta: false, mensaje: error.stack, error: true })),
                        { persistent: true }
                    );

                    if (a) {
                        logGreen("Mensaje enviado al canal", body.channel + ":", { feature: body.feature, estadoRespuesta: false, mensaje: error.stack, error: true });
                    }

                    const endTime = performance.now();
                    logPurple(`Tiempo de ejecución: ${endTime - startTime} ms`);
                } finally {
                    channel.ack(msg);
                }
            }
        });
    } catch (error) {
        logRed('Error al conectar con RabbitMQ:', error.stack);
    }
}

startConsumer();
