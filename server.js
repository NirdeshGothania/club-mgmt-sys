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
    secret: "secret", resave: false, saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/students/register", checkAuthenticated, (req, res) => {
    res.render("register");
});

app.get("/students/login", checkAuthenticated, (req, res) => {
    res.render("login");
});


app.get("/students/dashboard", checkNotAuthenticated, (req, res) => {
    res.render("dashboard", { user: req.user.name });
});

app.get("/students/logout", (req, res) => {
    req.flash("success_msg", "You have been logged out");
    req.logOut((done) => {
        res.redirect("/students/login");
    });
});

app.get("/students/forgotpassword", (req, res) => {
    res.render("forgotpassword");
});

app.post('/students/register', async (req, res) => {
    let { rollnumber, name, email, password, password2 } = req.body;

    console.log({
        rollnumber,
        name,
        email,
        password,
        password2

    });

    let errors = [];

    if (!rollnumber || !name || !email || !password || !password2) {
        errors.push({ message: "Enter all the details" });
    }

    if (password != password2) {
        errors.push({ message: "Password do not match" });
    }

    if (errors.length > 0) {
        res.render("register", { errors });
    } else {
        let hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);

        pool.query(
            `SELECT * FROM students
              WHERE rollnumber = $1`,
            [rollnumber],
            (err, results) => {
                if (err) {
                    console.log(err);
                }
                console.log(results.rows);

                if (results.rows.length > 0) {
                    errors.push({ message: "You are already registered" });
                    res.render('register', { errors });
                } else {
                    pool.query(
                        `INSERT INTO students (rollnumber, name, email, password) VALUES ($1, $2, $3, $4) RETURNING rollnumber, password`, [rollnumber, name, email, hashedPassword], (err, results) => {
                            if (err) {
                                throw err;
                            }

                            console.log(results.rows);
                            req.flash("success_msg", "You are now registered!");
                            res.redirect("/students/login")
                        }
                    )
                }
            }
        )

    }
});

app.post(
    "/students/login", passport.authenticate("local", {
        successRedirect: "/students/dashboard", failureRedirect: "/students/login", failureFlash: true
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

// app.post("/students/reset-password", (req, res, next) => {

// });

app.post("/students/forgotpassword", (req, res, next) => {
    // console.log("here");
    console.log(req.body);
    let { rollnumber } = req.body;
    console.log(rollnumber);

    pool.query(
        `SELECT * FROM students WHERE  rollnumber = $1`, [rollnumber],
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
                `INSERT INTO password_reset_tokens (student_id, token) VALUES ($1, $2)`,
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
                    

                })
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
                    `UPDATE students SET password = $1 WHERE rollnumber = $2`,
                    [hashedPassword, user.student_id],
                    (err) => {
                        if (err) {
                            console.log(err);
                            return res.status(500).json({ message: "Internal Server Error" });
                        }
                        console.log('reset pw for ' + user.student_id);

                        pool.query(
                            `DELETE FROM password_reset_tokens WHERE student_id = $1`,
                            [user.student_id],
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


app.listen(PORT, () => {
    console.log('Server is working on the port', PORT);
});



