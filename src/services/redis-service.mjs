import { createClient } from "redis";

export default class RedisService {

    constructor(app) {
        this.app = app;
        this.client = createClient();
        this.client.connect();
    }

    cacheJson(id, jsonStr) {
     
        this.client.json.set(id, '.', jsonStr);
    }
    
    getJson(id) {
        return this.client.json.get(id, '.');
    }

}