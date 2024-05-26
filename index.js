const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000


// Middleware

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://tranquil-stay.web.app',
        'https://tranquil-stay-server.vercel.app'

    ],
    credentials: true
}));
app.use(express.json());

require('dotenv').config()



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dfacken.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // User
        const userCollection = client.db('tranquilstayDB').collection('user')

        app.get('/user', async (req, res) => {
            const cursor = userCollection.find();
            const users = await cursor.toArray();
            res.send(users);
        })

        app.post('/user', async (req, res) => {
            const user = req.body;
            console.log('New USer: ', user);
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.patch('/user', async (req, res) => {
            const user = req.body
            const filter = { email: user.email };
            const updatedDoc = {
                $set: {
                    lastLoginAt: user.lastLoginAt
                }
            }

            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // Rooms
        const roomsCollection = client.db('tranquilstayDB').collection('rooms');
        app.get('/rooms', async (req, res) => {
            const cursor = roomsCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })
        app.get('/rooms/:id', async (req, res) => {
            const id = req.params.id;
            const queary = { _id: new ObjectId(id) };

            const result = await roomsCollection.findOne(queary);
            res.send(result);
        })

        // Booking
        const bookingCollection = client.db('tranquilstayDB').collection('booking');
        app.get('/booking', async (req, res) => {
            const cursor = bookingCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            console.log('booking: ', booking);
            const result = await bookingCollection.insertOne(booking);
            // res.json(result);

            const updateRoomAvailability = await roomsCollection.updateOne(
                { _id: new ObjectId (booking.bookingId) },
                { $set: { availability: false } }
            );

            if (result.insertedId && updateRoomAvailability.modifiedCount === 1) {
                res.json(result);
            } else {
                throw new Error('Booking created but failed to update room availability');
            }
        })

         


        app.get('/booking/:email', async (req, res) => {
            const email = req.params.email;
            const cursor = bookingCollection.find({ email: email });
            const result = await cursor.toArray();
            res.send(result);
        })







        // Feedback
        const feedbackCollection = client.db('tranquilstayDB').collection('feedback')

        app.get('/feedback', async (req, res) => {
            const cursor = feedbackCollection.find().sort({ timestamp: -1 });
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/feedback', async (req, res) => {
            const newCard = req.body;
            console.log('newCard: ', newCard);
            const result = await feedbackCollection.insertOne(newCard);
            res.json(result.ops[0]);
        })

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {


    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Tranquil stay server is running')
})

app.listen(port, () => {
    console.log(`Tranquil stay server running on port: ${port}`);
})