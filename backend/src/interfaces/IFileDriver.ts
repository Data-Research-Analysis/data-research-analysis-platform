export interface IFileDriver {
    initialize(): Promise<void>;
    getConcreteDriver(): Promise<any>;
    read(fileName: string): Promise<any>;
    write(fileName: string, content: string): Promise<any>;
    close(): Promise<void>;
}