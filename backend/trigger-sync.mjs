import { Queue, Document } from "theta-mn-queue";

async function triggerSync() {
  try {
    const mongodbSyncQueue = new Queue('DRAMongoDBSyncQueue');
    const index = await mongodbSyncQueue.getNextIndex();
    
    const job = new Document({
      id: index,
      key: 'mongodbSync',
      content: JSON.stringify({ dataSourceId: 69, syncType: 'full' })
    });
    
    await mongodbSyncQueue.enqueue(job);
    await mongodbSyncQueue.commit();
    
    console.log('✅ MongoDB sync job queued successfully!');
    console.log('Job ID:', index);
    console.log('The queue processor will pick it up within 15 seconds...');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

triggerSync();
