declare module 'topojson-client' {
    export function feature(topology: any, object: any): any;
    export function mesh(topology: any, object: any, filter?: (a: any, b: any) => boolean): any;
    export function merge(topology: any, objects: any[]): any;
}
