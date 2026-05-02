import { createClient } from 'redis';

// const url = process.env.REDIS_URL

export const redis = createClient();
redis.on('error', (error) => console.error(error))
await redis.connect();
export default redis;