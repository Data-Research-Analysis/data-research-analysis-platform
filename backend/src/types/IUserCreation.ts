import { EUserType } from "./EUserType.js";

export interface IUserCreation {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    user_type?: EUserType;
    is_conversion?: boolean;
}
