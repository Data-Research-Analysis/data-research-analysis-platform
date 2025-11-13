import { EUserType } from "./EUserType.js";

export interface ITokenDetails {
    user_id: number;
    email: string;
    user_type: EUserType;
    iat: number;
}