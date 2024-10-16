const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = 5000;
const multer = require('multer');
const path = require('path'); 


// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection (replace with your MongoDB URI)
mongoose.connect('mongodb+srv://gbesmano:123@cluster0.fkz2r.mongodb.net/project11')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

  // Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // 'uploads/' folder to store uploaded files
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname); // Unique file name
  }
});

const upload = multer({ storage: storage });

// Define the Review schema
const ReviewSchema = new mongoose.Schema({
  rating: {
    type: Number,
    required: true
  },
  review_title: {
    type: String,
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  proof: {
    type: String // This will store the path to the proof image
  },
  destination_id: {
    // type: mongoose.Schema.Types.ObjectId,
    type: String,
    ref: 'Destination',
    required: true
  },
  // client_user: {  // Reference to the client_users collection via the User model
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',  // Reference to the User model that is tied to the 'client_users' collection
  //   required: true
  // },

  user_id: {  // Reference to the client_users collection via the User model
   // type: mongoose.Schema.Types.ObjectId,
    type: String,
    ref: 'User',  // Reference to the User model that is tied to the 'client_users' collection
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'declined'],
    default: 'pending'
  },

}, { timestamps: true, versionKey: false });

// Define the Review model
const Review = mongoose.model('Review', ReviewSchema, 'reviews');



// Define the User schema NEW UPDATED
const UserSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: true
  },
  lastname: {
    type: String,
    required: true
  },
  birthdate: {
    type: Date,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  mobile_no: {
    type: String,
    required: true,
    unique: true
  },
  business_name: {
    type: String,
    default: "clientuser",
    required: true
  },
  type: {
    type: String,
    enum: ['admin', 'superadmin', 'owner', 'client'],
    default: 'client'
  },
  savedDestinations: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Destination'
    }
  ]
}, { timestamps: true, versionKey: false });

// Add a pre-save hook to clear savedDestinations if the type is not 'client'
UserSchema.pre('save', function(next) {
  if (this.type !== 'client') {
    this.savedDestinations = undefined; // Remove savedDestinations field
  }
  next();
});

// Apply transformations on toJSON or toObject to hide savedDestinations in admin, owner, or superadmin
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  if (user.type !== 'client') {
    delete user.savedDestinations; // Remove the field before sending the response
  }
  return user;
};

// //before
// // Define the User model using the 'users' collection
// const User = mongoose.model('User', UserSchema, 'users');


// Define the User model using the 'users' collection
const User = mongoose.model('User', UserSchema, 'users');



// Define the Destination schema
const DestinationSchema = new mongoose.Schema({
  //new
  locality: {
    type: String,
    required: true
  
  },
  destination_name: {
    type: String,
    required: true
  },
  destination_address: {
    type: String,
    required: true
  },
  coverphoto: {
    type: String,  // Store only the filename
    required: true,
    validate: {
      validator: function(value) {
        // Ensure it is a non-empty string (this can be adjusted as needed)
        return typeof value === 'string' && value.length > 0;
      },
      message: 'Coverphoto filename is required'
    }
  },

  category: {
    type: String,  // You can also use [String] if it's an array of categories
    required: true  // Make it required if necessary
  }



  
}, { timestamps: true, versionKey: false });

// Define the Destination model using the 'destinations' collection
const Destination = mongoose.model('Destination', DestinationSchema, 'destinations');


// Define the Fare schema
const FareSchema = new mongoose.Schema({
  locality: {
    type: String,
    required: true
  },
  vehicle: {
    type: String,
    required: true
  },
  operating_hours: {
    type: String,
    required: true
  },
  distance: {
    type: String,
    required: true
  },
  discounted_fare: {
    type: String,
    required: true
  },
  regular_fare: {
    type: String,
    required: true
  }
}, { timestamps: true, versionKey: false });

// Define the Fare model using the 'fares' collection
const Fare = mongoose.model('Fare', FareSchema, 'fares');




// ItinerarySchema
const ItinerarySchema = new mongoose.Schema({
  // location: {
  //   type: String,
  //   required: true
  // },
  locality: {
    type: String,
    required: true
  },
  number_days: {
    type: Number,
    required: true
  },
  group_size: {
    type: Number,
    required: true
  },
  trip_name: {
    type: String,
    required: true
  },
  category: {
    type: [String],  // Array of categories like Resort, Hotel, etc.
    required: true
  }
}, { timestamps: true, versionKey: false });

const Itinerary = mongoose.model('Itinerary', ItinerarySchema, 'itineraries');


// Route to save an itinerary
app.post('/save-itinerary', async (req, res) => {
  const { locality, number_days, group_size, trip_name, category} = req.body;

  try {
    // Find destinations based on the locality
    const destinations = await Destination.find({
      locality: { $regex: locality, $options: 'i' } // Case-insensitive search
    }).limit(10);

    if (destinations.length === 0) {
      return res.status(404).json({ message: 'No destinations found for this locality' });
    }

    // Extract distinct categories from the found destinations
    const categories = [...new Set(destinations.map(destination => destination.category))];

    // If no categories were found, you might want to handle it
    if (categories.length === 0) {
      return res.status(404).json({ message: 'No categories found for this locality' });
    }

    // Create a new itinerary with the categories from the destinations
    const newItinerary = new Itinerary({
      locality,
      number_days,
      group_size,
      trip_name,
      //category: categories // Use categories extracted from destinations
      category
    });

    // Save the itinerary to the database
    const savedItinerary = await newItinerary.save();

    console.log('Saved Itinerary:', savedItinerary);

    // Return the final response with the saved itinerary
    return res.status(201).json(savedItinerary);

  } catch (error) {
    console.error('Error saving itinerary:', error);
    return res.status(500).json({ message: 'Error saving itinerary', error });
  }
});

// Route to fetch distinct categories from destinations
app.get('/categories', async (req, res) => {
  try {
    const categories = await Destination.distinct('category');
    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error });
  }
});








// Route to fetch locality suggestions based on search query
app.get('/search-locality', async (req, res) => {
  const { query } = req.query; // Get the search query from the request

  try {
    const destinations = await Destination.find({
      locality: { $regex: query, $options: 'i' } // Case-insensitive search on locality
    }).limit(10); // Limit results to 10 suggestions

    if (destinations.length === 0) {
      return res.status(404).json({ message: 'No Locality found' });
    }

    const localityNames = destinations.map(destination => destination.locality);

    // Return the locality names as JSON
    res.status(200).json(localityNames);
  } catch (error) {
    console.error('Error fetching localities:', error);
    res.status(500).json({ message: 'Error fetching localities' });
  }
});




// Route to fetch fares based on locality
app.get('/fares', async (req, res) => {
  const { locality } = req.query;

  try {
    const fares = await Fare.find({
      designated_locality: { $regex: locality, $options: 'i' } // Case-insensitive search
    });

    if (fares.length === 0) {
      return res.status(404).json({ message: 'No fares found for this locality' });
    }

    res.status(200).json(fares);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching fares', error });
  }
});

// Route to fetch locality suggestions for fares (for auto-suggestions)
app.get('/localities', async (req, res) => {
  try {
    const localities = await Fare.distinct('designated_locality'); // Get unique localities

    res.status(200).json(localities);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching localities', error });
  }
});

// Signup route
app.post('/signup', async (req, res) => {
  const { firstname, lastname, email, birthdate, mobile_no, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = new User({
      firstname,
      lastname,
      email,
      birthdate,
      mobile_no,
      password,  // In a real-world app, hash the password before saving
    });

    await newUser.save();  // Insert user into the 'client_users' collection
    res.status(201).json({ message: 'User signed up successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password === password) {
      return res.status(200).json({ message: 'Login successful', userId: user._id });
    } else {
      return res.status(401).json({ message: 'Incorrect password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
});



// Search page, search bar
app.get('/destinations', async (req, res) => {
  const { search } = req.query;  // Get the search query from the request

  try {
    // Perform a search based on the destination name or category
    const destinations = await Destination.find({
      $or: [
        { destination_name: { $regex: search, $options: 'i' } }, // Search by destination name
        { category: { $regex: search, $options: 'i' } }         // Search by category
      ]
    }).limit(10);  // Limit the results to 10 destinations

    res.status(200).json(destinations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching destinations', error });
  }
});


// for coverphoto http
app.use(cors());

// coverphoto path
app.use('/destinations/coverphoto', express.static(path.join(__dirname, 'destinations/coverphoto')));
console.log('Serving static files from:', path.join(__dirname, 'destinations/coverphoto'));



app.use((req, res, next) => {
  console.log('Requested URL:', req.url); // Log every request
  next();
});

//carousel routes 
app.get('/carousel-destinations', async (req, res) => {
  try {
    const destinations = await Destination.find({})
      .select('_id destination_name destination_address operating_hours category about coverphoto ')
      .limit(5);
      console.log('Fetched Destinations:', destinations); 
    // Base URL for the Laravel server (where your images are stored)
    
    const laravelBaseUrl = 'http://192.168.254.100:5000/destinations/coverphoto/'; 
    //const laravelBaseUrl = 'http://127.0.0.1:8000/owner/destination/presentation/'; 
    //const laravelBaseUrl = 'http://192.168.254.111:5000/destinations'; 

    // Append the base URL to the coverphoto filename
    destinations.forEach(destination => {
      if (destination.coverphoto) {
        destination.coverphoto = `${laravelBaseUrl}${destination.coverphoto}`; // Construct the full URL
      }
    });

    

    res.status(200).json(destinations);
  } catch (error) {
    console.error('Error fetching carousel destinations:', error);
    res.status(500).json({ message: 'Error fetching carousel destinations', error: error.message });
  }
});




// Route to save a destination for a user
app.post('/save-destination', async (req, res) => {
  const { userId, destinationId } = req.body; // Expect userId and destinationId from request

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if destination is already saved
    if (!user.savedDestinations.includes(destinationId)) {
      user.savedDestinations.push(destinationId); // Save the destination
      await user.save(); // Update user document
      res.status(200).json({ message: 'Destination saved successfully' });
    } else {
      res.status(400).json({ message: 'Destination already saved' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error saving destination', error });
  }
});


// Route to unsave a destination for a user
app.post('/unsave-destination', async (req, res) => {
  const { userId, destinationId } = req.body; // Expect userId and destinationId from request

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const index = user.savedDestinations.indexOf(destinationId);
    if (index > -1) {
      user.savedDestinations.splice(index, 1); // Remove the destination from saved list
      await user.save(); // Update user document
      res.status(200).json({ message: 'Destination unsaved successfully' });
    } else {
      res.status(400).json({ message: 'Destination not found in saved list' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error unsaving destination', error });
  }
});

// Route to fetch saved destinations for a user
app.get('/saved-destinations/:userId', async (req, res) => {
  const { userId } = req.params; // Get the userId from the request parameters

  try {
    const user = await User.findById(userId).populate('savedDestinations'); // Populate the saved destinations
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user.savedDestinations); // Return the saved destinations
  } catch (error) {
    res.status(500).json({ message: 'Error fetching saved destinations', error });
  }
});


// Route to fetch destinations for review based on search query
app.get('/review-destinations', async (req, res) => {
  const { search } = req.query;  // Get the search query from the request

  try {
    // Perform a search based on the destination name and additional filters for reviewable destinations
    const destinations = await Destination.find({
      destination_name: { $regex: search, $options: 'i' },  // Case-insensitive search
      // Add any other conditions to fetch reviewable destinations (e.g., user-visited destinations, etc.)
    }).limit(10);  // Limit the results to 10 destinations

    res.status(200).json(destinations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviewable destinations', error });
  }
});

// for calling the firstname lastname'
app.get('/reviews', async (req, res) => {
  try {
    // Fetch reviews and populate the user field with firstname and lastname
    const reviews = await Review.find()
      .populate('user_id', 'firstname lastname') // Only populate the firstname and lastname fields from the User model
      .populate('destination', 'name'); // Populate the destination field if needed

    res.status(200).json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Error fetching reviews', error });
  }
});





app.post('/submit-review', upload.single('proof'), async (req, res) => {
  console.log('Submit review triggered on backend');
  console.log('Request body:', req.body);
  console.log('Uploaded file:', req.file);

  // Extract necessary fields from the request body
  //const { rating, review_title, comment, date, destinationId, client_user, status } = req.body; // Ensure client_user is passed
  const { rating, review_title, comment, date, destination_id, user_id, status, } = req.body; 
  const proof = req.file ? req.file.path : null;

  try {
    // Check if destination exists
    const destination = await Destination.findById(destination_id);
    if (!destination) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    // Check if the client_user exists in the User (client_users) collection
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create a new review with the associated client_user
    const newReview = new Review({
      rating,
      review_title,
      comment,
      date: new Date(date),  // Ensure the date is correctly parsed
      proof,
      destination_id: destination._id,
      // client_user: user._id  // Reference the user submitting the review
      //users: user._id,
      user_id: user._id,
      // users: user.firstname,
      // users: user.lastname,
      //newtest
      // firstname: user.firstname,  // Store firstname
      // lastname: user.lastname, 
      
    });

    // const newReview = new Review({
    //   rating,
    //   review_title,
    //   comment,
    //   date: new Date(date),  // Ensure the date is correctly parsed
    //   proof,
    //   destination: destination._id,
    //   client_user: user._id  // Reference the user submitting the review
    // });

    // Save the review to the 'reviews' collection
    await newReview.save();

    // Return success response
    res.status(201).json({ message: 'Review submitted successfully' });
  } catch (error) {
    console.error('Error submitting review:', error); // Log the full error
    res.status(500).json({ message: 'Error submitting review', error });
  }
});



//for ratings
app.get('/reviews/:destinationId', async (req, res) => {
  try {
    const { destinationId } = req.params;

    // Fetch all reviews for the destination and populate the 'client_user' field to get user info
    const reviews = await Review.find({ destination_id: destinationId })
      .populate({
        path: 'user_id',   // 'client_user' is the reference field in the Review schema
        // select: 'name',  // Select only the 'name' field from the 'client_users' collection
        select: 'firstname lastname', // Select both 'firstname' and 'lastname' fields
      });

    // Debugging step: check if the 'client_user' field is populated
    console.log("Reviews with populated client_user: ", reviews);

    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    reviews.forEach(review => {
      const rating = parseFloat(review.rating);
      if (rating >= 1 && rating <= 5) {
        totalRating += rating;
        const roundedRating = Math.round(rating);
        ratingBreakdown[roundedRating] += 1;
      }
    });

    const averageRating = totalRating / reviews.length;

    // Return reviews with the populated user info
    res.status(200).json({
      reviews: reviews.map(review => ({
        // name: review.users?.name || 'Unknown User',  // Check if client_user exists before accessing name
      //  name: `${review.users?.firstname || 'Unknown'} ${review.users?.lastname || 'User'}`,  // Concatenate firstname and lastname
        name: `${review.user_id?.firstname || 'Unknown'} ${review.user_id?.lastname || 'User'}`,  // Concatenate firstname and lastname
        rating: review.rating,
        review_title: review.review_title,
        comment: review.comment,
        date: review.date,
      })),
      averageRating: Number(averageRating.toFixed(1)),
      ratingBreakdown,
      totalReviews: reviews.length,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Error fetching reviews', error });
  }
});

//for profile page
app.get('/get-user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user data', error });
  }
});

// Route to fetch destinations based on categories
app.post('/destinations-by-category', async (req, res) => {
  const { categories } = req.body;

  try {
    const destinations = await Destination.find({
      category: { $in: categories }
    });

    if (!destinations.length) {
      return res.status(404).json({ message: 'No destinations found' });
    }

    res.status(200).json(destinations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching destinations', error });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


