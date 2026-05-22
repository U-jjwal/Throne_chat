import dotenv from 'dotenv';
dotenv.config();
import app from './src/app.js';
import connectDb from './src/db/index.js';





connectDb().then(() => {

    app.listen(process.env.PORT, () => {
        console.log(`Server running on port ${process.env.PORT}`);
    });

});