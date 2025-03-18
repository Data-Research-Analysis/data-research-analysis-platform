import bcrypt  from 'bcryptjs';
import jwt, { JwtPayload } from "jsonwebtoken";
import { UsersPlatform } from '../models/UsersPlatform';
import { UtilityService } from '../services/UtilityService';
import { IUsersPlatform } from '../types/IUsersPlatform';

export class AuthProcessor {
    private static instance: AuthProcessor;
    private constructor() {
    }

    public static getInstance(): AuthProcessor {
        if (!AuthProcessor.instance) {
            AuthProcessor.instance = new AuthProcessor();
        }
        return AuthProcessor.instance;
    }

    // public async validateJWT(token: string): Promise<Authentication|null> {
    //     return new Promise<Authentication|null>(async (resolve, reject) => {
    //         const secret = Utility.getInstance().getConstants('JWT_SECRET');
    //         let result: Authentication = {user_id: new mongoose.Types.ObjectId("000000000000")};
    //         try {
    //             const decoded = jwt.verify(token, secret) as JwtPayload;
    //             if (decoded) {
    //                 const userId = decoded.user_id;
    //                 const email = decoded.email;
    //                 const user = await User.findOne({ _id: userId, email: email }).exec();
    //                 if (user) {
    //                     result.user_id = user._id;
    //                     return resolve(result);  
    //                 } else {
    //                     return resolve(null);
    //                 }
    //             }
    //         } catch (error) {
    //             return resolve(null);
    //         }
    //     });
    // }

    public async login(email: string, password: string): Promise<IUsersPlatform> {
        return new Promise<IUsersPlatform>(async (resolve, reject) => {
            const user:UsersPlatform = await UsersPlatform.findOne({where: {email: email}});
            if (user) {
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (passwordMatch) {
                    const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
                    const token = jwt.sign({user_id: user.id, email: email}, secret);
                    const userPlatform:IUsersPlatform = {id: user.id, email: email, first_name: user.first_name, last_name: user.last_name, token: token};
                    return resolve(userPlatform);
                } else {
                    return resolve(null);
                }
            } else {
                return resolve(null);
            }
        });
    }

    public async register(firstName: string, lastName: string, email: string, password: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const user:UsersPlatform = await UsersPlatform.findOne({where: {email: email}});
            if (!user) {
                console.log("User does not exist for the given email, so creating a new user");
                const encryptedPassword = await bcrypt.hash(password, 10);
                const newUser:UsersPlatform = await UsersPlatform.create({
                    email: email, first_name: firstName,
                    last_name: lastName, password: encryptedPassword
                });
                return resolve(true);                    
            } else {
                return resolve(false);
            }
        });
    }
}