const express = require("express");
const app = express();
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const PORT = process.env.PORT || 5002;
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const initializePassport = require("./passportConfig");
initializePassport(passport);

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/students/register", checkAuthenticated, (req, res) => {
    res.render("register")
});

app.get("/students/login", checkAuthenticated, (req, res) => {
    res.render("login");
});

app.get("/students/dashboard", (req, res) => {

    const userRole = req.user.role;

    pool.query(
        `SELECT * FROM users WHERE role = 2`,
        (err, stud) => {
            if (err) {
                console.log(err);
                req.flash("error_msg", "Failed to fetch students");
                res.redirect("/students/dashboard");
            } 
            else {
                if (userRole === 0) {
                    res.render("admin-dashboard", { user: req.user.name, students: stud.rows });
                } 
                else if (userRole === 1) {
                    res.render("coordinator-dashboard", { user: req.user.name });
                } 
                else {
                    res.render("student-dashboard", { user: req.user.name });
                }
                console.log(stud.rows);
            }
        }
    );
   
});

app.get("/students/logout", (req, res) => {
    req.flash("success_msg", "You have been logged out");
    req.logOut((done) => {
        res.redirect("/students/login");
    });
});

// function isAdmin(req, res, next) {
//     // Check if the user is authenticated and has the role of an admin (role === 0)
//     if (req.isAuthenticated() && req.user.role === 0) {
//         return next(); // User is an admin, allow access to the next middleware or route handler
//     }
    
    // If not an admin or not authenticated, redirect to a restricted page (e.g., login)
    // res.redirect("/login");
// }

app.get("/students/forgotpassword", (req, res) => {
    res.render("forgotpassword");
});

app.post('/students/register', async (req, res) => {
    let { rollnumber, name, email, password, password2 } = req.body;

    // Set the role to 0 (student) by default
    const role = 2;

    console.log({
        rollnumber,
        name,
        email,
        password,
        password2,
        role
    });

    let errors = [];

    if (!rollnumber || !name || !email || !password || !password2) {
        errors.push({ message: "Enter all the details" });
    }

    if (password !== password2) {
        errors.push({ message: "Passwords do not match" });
    }

    if (errors.length > 0) {
        res.render("register", { errors });
    } else {
        let hashedPassword = await bcrypt.hash(password, 10);

        pool.query(
            `SELECT * FROM users
              WHERE rollnumber = $1`,
            [rollnumber],
            (err, results) => {
                if (err) {
                    console.log(err);
                }

                if (results.rows.length > 0) {
                    errors.push({ message: "You are already registered" });
                    res.render('register', { errors });
                } else {
                    // Insert the new user with the default role 'student'
                    pool.query(
                        `INSERT INTO users (rollnumber, name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING rollnumber, password`,
                        [rollnumber, name, email, hashedPassword, role],
                        (err, results) => {
                            if (err) {
                                console.log(err);
                                req.flash("error_msg", "Registration failed");
                                res.redirect("/students/register");
                            } else {
                                req.flash("success_msg", "You are now registered, Welcome!");
                                res.redirect("/students/login");
                            }
                        }
                    );
                }
            }
        );
    }
});

app.post(
    "/students/login", passport.authenticate("local", {
        successRedirect: "/students/dashboard",
        failureRedirect: "/students/login",
        failureFlash: true
    })
);

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect("/students/dashboard");
    }
    next();
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/students/login");
}

const transporter = nodemailer.createTransport({
    service: 'Hotmail',
    auth: {
        user: 'nirdesh2001@hotmail.com',
        pass: 'Gothania@1234',
    },
});

app.post("/students/forgotpassword", (req, res, next) => {
    // console.log("here");
    console.log(req.body);
    let { rollnumber } = req.body;
    console.log(rollnumber);

    pool.query(
        `SELECT * FROM users WHERE  rollnumber = $1`, [rollnumber],
        (err, results) => {
            if (err) {
                console.log(err);
            }
            console.log("results", results);

            if (results.rows.length < 1) {
                req.flash("error_msg", "Email does not exist!");
                res.render("forgotpassword");
                return;
            }

            const user = results.rows[0];
            let token = bcrypt.hashSync(Math.random().toString(36).substring(7), 10).replaceAll('/', '0');

            pool.query(
                `INSERT INTO password_reset_tokens (user_id, token) VALUES ($1, $2)`,
                [user.rollnumber, token],
                (err) => {
                    if (err) {
                        console.log(err);
                    }

                    const resetLink = `http://localhost:5002/students/reset-password/${token}`;
                    const mailOptions = {
                        from: 'nirdesh2001@hotmail.com',
                        to: results.rows[0].email,
                        subject: 'Password Reset',
                        text: `Hi ${results.rows[0].name},
                        You have requested to reset your password.
                        Click on the following link to reset your password: ${resetLink}`,
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error(error);
                            return res.status(500).json({ message: 'Failed to send email' });
                        }

                        console.log(`Password reset email sent: ${info.response}`);
                        req.flash("success_msg", "Password reset link sent to your email");
                        res.redirect("/students/login");
                        return res.status(200).json({ message: 'Password reset link sent to your email' });
                    });
                }
            );
        });
});

app.get("/students/reset-password/:token", (req, res) => {
    const { token } = req.params;

    pool.query(
        `SELECT * FROM password_reset_tokens WHERE token = $1`,
        [token],
        (err, results) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ message: "Internal Server Error" });
            }

            if (results.rows.length === 0) {
                req.flash("error_msg", "Invalid or expired token");
                return res.redirect("/students/login");
            }

            res.render("reset-password", { token });
        }
    );
});

app.post("/students/reset-password/:token", (req, res) => {
    const { token } = req.params;
    const { password, password2 } = req.body;

    if (password !== password2) {
        req.flash("error_msg", "Passwords do not match");
        return res.redirect(`/students/reset-password/${token}`);
    }

    pool.query(
        `SELECT * FROM password_reset_tokens WHERE token = $1`,
        [token],
        (err, results) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ message: "Internal Server Error" });
            }

            if (results.rows.length === 0) {
                req.flash("error_msg", "Invalid or expired token");
                return res.redirect("/students/login");
            }

            const user = results.rows[0];

            bcrypt.hash(password, 10, (err, hashedPassword) => {
                if (err) {
                    console.log(err);
                    return res.status(500).json({ message: "Internal Server Error" });
                }

                pool.query(
                    `UPDATE users SET password = $1 WHERE rollnumber = $2`,
                    [hashedPassword, user.user_id],
                    (err) => {
                        if (err) {
                            console.log(err);
                            return res.status(500).json({ message: "Internal Server Error" });
                        }
                        console.log('reset pw for ' + user.user_id);

                        pool.query(
                            `DELETE FROM password_reset_tokens WHERE user_id = $1`,
                            [user.user_id],
                            (err) => {
                                if (err) {
                                    console.log(err);
                                    return res.status(500).json({ message: "Internal Server Error" });
                                }

                                req.flash("success_msg", "Password reset successful");
                                res.redirect("/students/login");
                            }
                        );
                    }
                );
            });
        }
    );
});


app.post("/students/dashboard/promote-coordinator/:userId", (req, res) => {
    const { userId } = req.params;

    pool.query(
        `UPDATE users SET role = 1 WHERE user_id = $1`,
        [userId],
        (err) => {
            if (err) {
                console.log(err);
                req.flash("error_msg", "Failed to promote user to coordinator");
            } else {
                req.flash("success_msg", "User promoted to coordinator successfully");
            }
            res.redirect("/students/dashboard");
        }
    );
});



app.listen(PORT, () => {
    console.log('Server is working on the port', PORT);
});