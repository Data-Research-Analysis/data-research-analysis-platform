import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsCommand, ListObjectsCommandOutput, ObjectIdentifier, PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import fetch from "node-fetch";
import { Readable } from "stream";
import { UtilityService } from "./UtilityService.js";
import { WinstonLoggerService } from "./WinstonLoggerService.js";

export class AWSService {

    private static instance: AWSService;
    private region: string;
    private s3client: S3Client;
    private bucketName: string;

    private constructor() {}
    public static getInstance(): AWSService {
        if (!AWSService.instance) {
            AWSService.instance = new AWSService();
        }
        return AWSService.instance;
    }

    public initialize(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
        const bucketName = UtilityService.getInstance().getConstants('AWS_S3_IMAGES_EXTRACT_BUCKET');
        const region = UtilityService.getInstance().getConstants('AWS_S3_REGION');
        const accessKeyId = UtilityService.getInstance().getConstants('AWS_ACCESS_KEY_ID');
        const secretAccessKey = UtilityService.getInstance().getConstants('AWS_SECRET_ACCESS_KEY');
        this.region = region;
        this.bucketName = bucketName;
        this.s3client = new S3Client({
                region,
                credentials: {
                    accessKeyId,
                    secretAccessKey
                }
            });
            return resolve();
        });
    }

    public getRegion(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            return resolve(this.region);
        });
    }

    public getS3Client(): Promise<S3Client> {
        return new Promise<S3Client>((resolve, reject) => {
            return resolve(this.s3client);
        });
    }

    public getBucketName(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            return resolve(this.bucketName);
        });
    }

    public async getListOfObjectsFromS3Bucket(): Promise<ListObjectsCommandOutput> {
        return new Promise<ListObjectsCommandOutput>(async (resolve, reject) => {
            await this.initialize();
            const bucketParams = { Bucket: this.bucketName };
            const command = new ListObjectsCommand(bucketParams);
            return resolve(this.s3client.send(command));
        });
    }

    public async deleteAllFilesFromS3Bucket(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const images = await this.getListOfObjectsFromS3Bucket();
            if (images.Contents && images.Contents.length > 0) {
                const objects: ObjectIdentifier[] = [];
                images.Contents.forEach(content => {
                    objects.push({ Key: content.Key });
                });
                this.s3client.send(new DeleteObjectsCommand({ 
                    Bucket: await this.getBucketName(), 
                    Delete: {
                        Objects: objects
                    } 
                }));
            }
            return resolve();
        });
    }

    public async uploadFileToS3Bucket(fileName: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            await this.initialize();
            const res = await fetch(fileName);
            const resBuffer = await res.buffer();
            const keyParts = fileName.split('/');
            const key = keyParts[keyParts.length - 1];
            const bucketParams = {
                Bucket: await this.getBucketName(),
                Key: key,
                Body: resBuffer,
            };
            const command = new PutObjectCommand(bucketParams);
            await this.s3client.send(command);
            return resolve();
        });
    }

    public async getS3Object(key: string): Promise<Uint8Array[]> {
        return new Promise<Uint8Array[]>(async (resolve, reject) => {
            await this.initialize();
            let responseDataChunks: Uint8Array[] = [];
            const response = await this.s3client.send(new GetObjectCommand({Bucket: this.bucketName, Key: key}));
            const stream = response.Body as unknown as Readable;
            stream.on('data', chunk => responseDataChunks.push(chunk));
            stream.on('end', async () => {
                // console.log("responseDataChunks", responseDataChunks.join(''));
                // const blocksData = await this.extractTextFromImage(imageName, responseDataChunks);
                // console.log("blocksData", blocksData);
                // FilesService.getInstance().writeToMetaDataFile(`amazontest.json`, JSON.stringify(blocksData));
                return resolve(responseDataChunks);
              });
        });
    }
}