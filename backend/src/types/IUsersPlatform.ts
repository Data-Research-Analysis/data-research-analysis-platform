import { EUserType } from "./EUserType";

export interface IUsersPlatform {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    user_type: EUserType;
    token: string;
}