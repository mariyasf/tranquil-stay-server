const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
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
    credentials: true,
    optionsSuccessStatus: 200,
}));
app.use(express.json());
app.use(cookieParser());

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

const cookieOption = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' ? true : false,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
};

// user MiddleWare
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded;
        next();
    })
}


async function run() {
    try {
        // jwt
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log(user);

            const token = jwt.sign(
                user,
                process.env.ACCESS_TOKEN_SECRET,
                {
                    expiresIn: '30d'
                }
            )

            res
                .cookie('token', token, cookieOption)
                .send({ success: true })
        });

        app.get('/logout', async (req, res) => {
            const user = req.body;
            console.log('logging out', user);
            res
                .clearCookie('token', {
                    ...cookieOption,
                    maxAge: 0
                })
                .send({ success: true })
        })


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

        app.get('/rooms/:id', verifyToken, async (req, res) => {
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

        app.get('/booking/:email', verifyToken, async (req, res) => {

            console.log('user in the valid token', req.user)

            if (req.params.email !== req.user.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const email = req.params.email;
            const cursor = bookingCollection.find({ email: email });
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/booking/:email/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const queary = { _id: new ObjectId(id) };

            const result = await bookingCollection.findOne(queary);
            res.send(result);
        });


        app.post('/booking', async (req, res) => {
            const booking = req.body;
            console.log('booking: ', booking);
            const result = await bookingCollection.insertOne(booking);
            // res.json(result);

            const updateRoomAvailability = await roomsCollection.updateOne(
                { _id: new ObjectId(booking.bookingId) },
                { $set: { availability: false } }
            );

            if (result.insertedId && updateRoomAvailability.modifiedCount === 1) {
                res.json(result);
            } else {
                throw new Error('Booking created but failed to update room availability');
            }
        })


        app.patch('/booking/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };
                const option = { upsert: true };

                const {
                    newCheckIn,
                    newCheckOut,
                    newAdults,
                    newChild
                } = req.body;

                const updatedCard = {
                    $set: {
                        checkIn: newCheckIn,
                        checkOut: newCheckOut,
                        adults: newAdults,
                        child: newChild
                    }
                }

                const result = await bookingCollection.updateOne(filter, updatedCard, option);

                if (result.modifiedCount === 1) {
                    res.status(200).json({ message: 'Booking updated successfully' });
                } else {
                    res.status(404).json({ error: 'Booking not found' });
                }
            } catch (err) {
                console.error('Error updating booking:', err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });


        app.delete('/booking/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });

            if (booking) {
                await bookingCollection.deleteOne({ _id: new ObjectId(id) });

                await roomsCollection.updateOne(
                    { _id: new ObjectId(booking.bookingId) },
                    { $set: { availability: true } }
                );
                res.status(200).send({ message: 'Booking deleted and room availability updated' });
            } else {
                res.status(404).send({ message: 'Booking not found' });
            }
        });



        // Feedback
        const feedbackCollection = client.db('tranquilstayDB').collection('feedback')

        app.get('/feedback', async (req, res) => {
            const cursor = feedbackCollection.find().sort({ timestamp: -1 });
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/feedback/:bookingId', verifyToken, async (req, res) => {
            const bookingId = req.params.bookingId;
            console.log(bookingId)


            const feedbacks = await feedbackCollection
                .find({ bookingId: bookingId }).toArray();
            // console.log(feedbacks)

            // res.status(200).json(feedbacks);
            res.send(feedbacks)

        });

        app.post('/feedback', async (req, res) => {
            try {
                const newFeedback = req.body;

                const result = await feedbackCollection.insertOne(newFeedback);
                res.status(201).json({ insertedId: result.insertedId });

            } catch (error) {
                console.error('Error inserting feedback:', error);
                res.status(500).json({ message: 'Internal Server Error' });
            }

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