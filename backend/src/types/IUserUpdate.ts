import { EUserType } from "./EUserType.js";

export interface IUserUpdate {
    first_name?: string;
    last_name?: string;
    email?: string;
    user_type?: EUserType;
}
