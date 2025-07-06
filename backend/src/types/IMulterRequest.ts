import { Request } from "express";

export interface IMulterRequest extends Request {
    file: Express.Multer.File;
}