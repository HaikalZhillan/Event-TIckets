import { Worker } from 'bullmq';

const worker = new Worker(
  'default-queue',
  async job => {
    console.log('Job diterima');
    console.log(' Job name:', job.name);
    console.log('Job data:', job.data);

    return { success: true };
  },
  {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  },
);

worker.on('completed', job => {
  console.log(`Job ${job.id} selesai`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} gagal`, err);
});

console.log('BullMQ worker started');
