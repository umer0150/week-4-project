import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import dotenv from "dotenv";

dotenv.config();

const db = drizzle(process.env.DATABASE_URL!, { schema });

export default db;