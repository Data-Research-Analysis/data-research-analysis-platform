import bcrypt  from 'bcryptjs';
import jwt, { JwtPayload } from "jsonwebtoken";
import { UsersPlatform } from '../models/UsersPlatform';

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

    public async login(email: string, password: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            // const user = await User.findOne({email: email}).exec();
            // if (user) {
            //     const passwordMatch = await bcrypt.compare(password, user.password);
            //     if (passwordMatch) {
            //         const secret = Utility.getInstance().getConstants('JWT_SECRET');
            //         let token = jwt.sign({user_id: user.id, email: email}, secret);
            //         return resolve(token);
            //     }
            // } else {
            //     return resolve('');
            // }
        });
    }

    public async register(firstName: string, lastName: string, email: string, password: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            console.log("Registering user");
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
                console.log("User already exists");
                return resolve(false);
            }
        });
    }
}