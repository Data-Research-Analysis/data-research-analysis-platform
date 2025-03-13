import dotenv from 'dotenv';

export class DBDriver {
    public async initialize() {
        dotenv.config();
    }

    public getDriver() {
        return null;
    }

    public async query(query: string, params: any) {

    }

    public async close() {
        console.log('Closing connection');
    }
}