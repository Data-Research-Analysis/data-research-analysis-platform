import winston from 'winston';

export class WinstonLoggerService {
    private static instance: WinstonLoggerService;
    private logger: winston.Logger;

    private constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [
                new winston.transports.File({ filename: 'error.log', level: 'error' }),
                new winston.transports.File({ filename: 'combined.log' }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    public static getInstance(): WinstonLoggerService {
        if(!WinstonLoggerService.instance) {
            WinstonLoggerService.instance = new WinstonLoggerService();
        }
        return WinstonLoggerService.instance;
    }

    public log(level: string, message: string): void {
        this.logger.log(level, message);
    }
}