const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://mustafaneguib:Jo74X6EYdtWXHDml@cluster0.dpzqbfe.mongodb.net/cubic';
const client = new MongoClient(uri);

async function check() {
  try {
    await client.connect();
    const db = client.db('cubic');
    const collections = await db.listCollections().toArray();
    console.log('Collections found:', collections.length);
    console.log('Names:', collections.map(c => c.name).join(', '));
    
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`  ${col.name}: ${count} documents`);
    }
  } finally {
    await client.close();
  }
}
check();
