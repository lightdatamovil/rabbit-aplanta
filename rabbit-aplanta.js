import { connect } from 'amqplib';
import dotenv from 'dotenv';
import { Worker } from 'worker_threads';
import { verifyParameters } from './src/funciones/verifyParameters.js';
import { logBlue, logGreen, logPurple, logRed } from './src/funciones/logsCustom.js';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME_COLECTA = process.env.QUEUE_NAME_COLECTA;

async function startConsumer() {
  try {
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

          // Crear el worker y pasarle los datos
          const worker = new Worker('./worker.js');
          worker.postMessage(body);

          worker.on('message', (response) => {
            if (response.result) {
              channel.sendToQueue(
                body.channel,
                Buffer.from(JSON.stringify(response.result)),
                { persistent: true }
              );
              logGreen(`Mensaje enviado al canal ${body.channel} : ${JSON.stringify(response.result)}`);
            } else {
              channel.sendToQueue(
                body.channel,
                Buffer.from(JSON.stringify({ error: true, message: response.error })),
                { persistent: true }
              );
              logRed(`Error procesando en worker: ${response.error}`);
            }

            const endTime = performance.now();
            logPurple(`Tiempo de ejecución en el consumer: ${endTime - startTime} ms`);
          });

          worker.on('error', (err) => {
            logRed('Error en worker:', err);
          });

          worker.on('exit', (code) => {
            if (code !== 0) {
              logRed(`Worker terminó con código ${code}`);
            }
          });
        } catch (error) {
          logRed(`Error al procesar el mensaje: ${error.stack}`);
          channel.sendToQueue(
            body.channel,
            Buffer.from(JSON.stringify({ error: true, message: error.stack })),
            { persistent: true }
          );
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
