import { Worker } from 'worker_threads';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const worker = new Worker('./worker.js');

worker.on('message', (message) => {
    console.log('Mensaje del worker:', message);
});

worker.on('error', (error) => {
    console.error('Error en el worker:', error);
});

worker.on('exit', (code) => {
    console.log(`Worker finalizado con código ${code}`);
});
