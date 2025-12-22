import { setupApp } from "../server/index.ts";

let appPromise: Promise<any> | null = null;

export default async (req: any, res: any) => {
    if (!appPromise) {
        appPromise = setupApp();
    }
    const app = await appPromise;
    return app(req, res);
};
