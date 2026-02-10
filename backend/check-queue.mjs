import { Queue } from "theta-mn-queue";

async function checkQueue() {
  try {
    const mongodbSyncQueue = new Queue('DRAMongoDBSyncQueue');
    const length = await mongodbSyncQueue.length();
    
    console.log(`MongoDB Sync Queue length: ${length}`);
    
    if (length > 0) {
      console.log('✅ Queue has jobs waiting');
    } else {
      console.log('⚠️ Queue is empty - no jobs to process');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkQueue();
