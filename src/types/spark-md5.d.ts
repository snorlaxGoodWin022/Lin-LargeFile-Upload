declare module 'spark-md5' {
  export class SparkMD5 {
    static hash(str: string): string;
    static ArrayBuffer(): SparkMD5;
    append(data: ArrayBuffer | string): SparkMD5;
    end(): string;
  }
  export default SparkMD5;
}
