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
const moment = require('moment-timezone');

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

app.get("/students/create-clubs", (req, res) => {
    res.render("create-clubs");
});


app.get("/students/login", checkAuthenticated, (req, res) => {
    res.render("login");
});


function groupClubsAndCoordinators(data) {
    const clubData = {};

    data.forEach((row) => {
        if (!clubData[row.club_id]) {
            clubData[row.club_id] = {
                club_name: row.club_name,
                coordinators: []
            };
        }

        if (row.coordinator_name) {
            clubData[row.club_id].coordinators.push(row.coordinator_name);
        }
    });

    return Object.values(clubData);
}

app.get("/students/dashboard", (req, res) => {

    const userRole = req.user.role;
    const userId = req.user.user_id;

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    pool.query(
        `SELECT * FROM users WHERE role = 2`,
        (err, stud) => {
            if (err) {
                console.log(err);
                req.flash("error_msg", "Failed to fetch students");
                return res.redirect("/students/dashboard");
            } else {
                if (userRole === 0) {

                    let query = `SELECT club_table.name AS club_name,
                            create_events.*,
                            registered_students.*,
                            users.* 
                            FROM club_table 
                            JOIN create_events ON club_table.club_id = create_events.club_id 
                            LEFT JOIN registered_students ON create_events.event_id = registered_students.event_id 
                            LEFT JOIN users ON registered_students.user_id = users.user_id 
                            WHERE status = true`;
                    if (startDate && endDate) {
                        query += ` AND create_events.start_date >= '${startDate}' AND create_events.start_date <= '${endDate}'`;
                    }

                    pool.query(query, (err, event_list) => {
                        if (err) {
                            console.log(err);
                        }
                        else {


                            event_list.rows.forEach(event => {
                                event.students = (event.students || []).concat(event.name && event.rollnumber || []);
                            });

                            pool.query(
                                `SELECT club_table.name AS club_name,
                                create_events.*
                                FROM club_table JOIN create_events ON club_table.club_id = create_events.club_id
                                WHERE status IS NULL`,
                                (err, events) => {
                                    if (err) {
                                        console.log(err);
                                        req.flash("error_msg", "Failed to fetch events");
                                        res.redirect("/students/dashboard");
                                    } else {
                                        pool.query(
                                            `SELECT club_table.club_id, club_table.name AS club_name, users.name AS coordinator_name
                                            FROM club_table
                                            LEFT JOIN club_coordinator ON club_table.club_id = club_coordinator.club_id
                                            LEFT JOIN users ON club_coordinator.user_id = users.user_id`,
                                            (err, results) => {
                                                if (err) {
                                                    console.log(err);
                                                    req.flash("error_msg", "Failed to fetch club data");
                                                }



                                                const clubsData = groupClubsAndCoordinators(results.rows);


                                                pool.query(
                                                    `SELECT club_table.club_id, club_table.name AS club_name
                                                    FROM club_table
                                                    WHERE club_table.club_id NOT IN (
                                                    SELECT club_id FROM club_coordinator
                                                )`,
                                                    (err, clubsWithoutCoordinators) => {
                                                        if (err) {
                                                            console.log(err);
                                                            req.flash("error_msg", "Failed to fetch clubs without coordinators");
                                                        }
                                                        const uniqueClubs = results.rows.reduce((acc, current) => {
                                                            const existingClub = acc.find((club) => club.club_id === current.club_id);

                                                            if (!existingClub) {
                                                                acc.push(current);
                                                            }

                                                            return acc;
                                                        }, []);
                                                        res.render("admin-dashboard", {
                                                            user: req.user.name,
                                                            students: stud.rows,
                                                            clubs: clubsData,
                                                            club_list: uniqueClubs,
                                                            clubsWithoutCoordinators: clubsWithoutCoordinators.rows,
                                                            events: events.rows,
                                                            event_list: event_list.rows,
                                                            startDate: startDate,
                                                            endDate: endDate,
                                                        });
                                                    }
                                                );
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    });

                } else if (userRole === 1) {

                    pool.query(
                        `SELECT *
                         FROM create_events
                         WHERE club_id = (SELECT club_id FROM club_coordinator WHERE user_id = $1)`,
                        [userId],
                        (err, events) => {
                            if (err) {
                                console.log(err);
                                req.flash("error_msg", "Failed to fetch events");
                                res.redirect("/students/dashboard");
                            } else {
                                const eventsData = [];
                                const promises = events.rows.map((event) => {
                                    return new Promise((resolve, reject) => {
                                        pool.query(
                                            `SELECT users.name AS student_name, users.rollnumber
                                            FROM registered_students
                                            JOIN users ON registered_students.user_id = users.user_id
                                            WHERE registered_students.event_id = $1`,
                                            [event.event_id],
                                            (err, students) => {
                                                if (err) {
                                                    console.log(err);
                                                    reject(err);
                                                } else {
                                                    console.log("student name issue: ", students.rows);
                                                    eventsData.push({
                                                        event_id: event.event_id,
                                                        event_name: event.event_name,
                                                        event_desc: event.event_desc,
                                                        start_date: event.start_date,
                                                        end_date: event.end_date,
                                                        room: event.room,
                                                        budget: event.budget,
                                                        status: event.status,
                                                        students: students.rows,
                                                    });
                                                    resolve();
                                                }
                                            }
                                        );
                                    });
                                });
                                Promise.all(promises)
                                    .then(() => {

                                        res.render("coordinator-dashboard", {
                                            user: req.user.name,
                                            events: eventsData
                                        });
                                    })
                                    .catch((error) => {
                                        console.log(error);
                                        res.redirect("/students/dashboard");
                                    });
                            }
                        }
                    );



                } else {

                    pool.query(
                        `SELECT * FROM club_table JOIN create_events ON club_table.club_id = create_events.club_id WHERE status = true`,
                        (err, events) => {
                            if (err) {
                                console.log(err);
                                req.flash("error_msg", "Failed to fetch events");
                                res.redirect("/students/dashboard");
                            } else {
                                // Assuming events.rows is an array of events
                                const eventIds = events.rows.map(event => event.event_id);
                                console.log(eventIds);

                                const currentDateTime = moment().tz('UTC').format();

                                pool.query(
                                    `SELECT * FROM club_table JOIN create_events ON club_table.club_id = create_events.club_id 
                                    LEFT JOIN registered_students ON create_events.event_id = registered_students.event_id 
                                    WHERE create_events.event_id = ANY($1) AND registered_students.user_id IS NULL AND create_events.start_date >= $2`,
                                    [eventIds.map(id => BigInt(id)), currentDateTime],
                                    (err, event_reg) => {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            pool.query(`SELECT * FROM club_table LEFT JOIN create_events ON club_table.club_id = create_events.club_id 
                                            LEFT JOIN registered_students ON create_events.event_id = registered_students.event_id WHERE registered_students.user_id = $1`, [userId], (err, events_sel) => {
                                                if (err) {
                                                    console.log(err);
                                                }
                                                res.render("student-dashboard", { user: req.user.name, userId: req.user.user_id, events: events.rows, event_reg: event_reg.rows, events_sel: events_sel.rows });

                                            });


                                        }
                                    }
                                );
                                console.log("Fetched events:", events.rows);
                            }
                        }
                    );



                }
                console.log(stud.rows);
            }
        }
    );
});

function checkAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 0) {
        return next();
    } else {
        req.flash("error_msg", "Access denied. Admin privileges required.");
        return res.redirect("/students/login");
    }
}

app.get("/students/logout", (req, res) => {
    req.flash("success_msg", "You have been logged out");
    req.logOut((done) => {
        res.redirect("/students/login");
    });
});


app.get("/students/forgotpassword", (req, res) => {
    res.render("forgotpassword");
});

app.post("/students/create-clubs", (req, res) => {
    const { clubname, rollnumber } = req.body;
    console.log("Club Name:", clubname);

    if (!clubname) {
        console.error("error_msg", "Club name is required");
        return res.redirect("/students/create-clubs");
    }
    pool.query(`SELECT user_id FROM users WHERE rollnumber = $1`, [rollnumber], (err, result) => {
        if (err) {
            console.log(err);
        }
        else {
            const userId = result.rows[0].user_id;
            console.log(userId);
            pool.query(`UPDATE users SET role = 1 WHERE user_id = $1`, [userId], (err) => {
                if (err) {
                    console.log(err);
                }
                else {
                    pool.query(
                        `INSERT INTO club_table (name) VALUES ($1) RETURNING club_id`,
                        [clubname],
                        (err, clubResult) => {
                            if (err) {
                                console.log(err);
                                req.flash("error_msg", "Failed to create the club");
                                res.redirect("/students/dashboard");
                            } else {
                                const clubId = clubResult.rows[0].club_id;

                                pool.query(
                                    `INSERT INTO club_coordinator (club_id, user_id) VALUES ($1, $2)`,
                                    [clubId, userId],
                                    (err) => {
                                        if (err) {
                                            console.log(err);
                                            req.flash("error_msg", "Failed to assign the coordinator");
                                        } else {
                                            req.flash("success_msg", "Club created.");
                                        }
                                        res.redirect("/students/dashboard");
                                    }
                                );
                            }
                        }
                    );
                }
            });

        }
    });

});

app.post('/students/register', async (req, res) => {
    let { rollnumber, name, email, password, password2 } = req.body;

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
    // console.log(req.body.clubId);
    const userId = req.params.userId;
    const clubId = req.body.clubId;
    console.log("req.body = ", req.body);

    // console.log(clubId);

    pool.query(
        `UPDATE users SET role = 1 WHERE user_id = $1`,
        [userId],
        (err) => {
            if (err) {
                console.log(err);
                req.flash("error_msg", "Failed to promote user to coordinator");
                res.redirect("/students/dashboard");
            } else {
                pool.query(
                    `SELECT * FROM club_coordinator WHERE club_id = $1 AND user_id = $2`,
                    [clubId, userId],
                    (err, results) => {
                        if (err) {
                            console.log(err);
                            req.flash("error_msg", "Failed to check coordinator assignment");
                            res.redirect("/students/dashboard");
                        } else if (results.rows.length === 0) {
                            pool.query(
                                `INSERT INTO club_coordinator (club_id, user_id) VALUES ($1, $2)`,
                                [clubId, userId],
                                (err) => {
                                    if (err) {
                                        console.log(err);
                                        req.flash("error_msg", "Failed to assign coordinator to the club");
                                    } else {
                                        req.flash("success_msg", "User promoted to coordinator and assigned to the club successfully");
                                    }
                                    res.redirect("/students/dashboard");
                                }
                            );
                        }
                    }
                );
            }
        }
    );
});


app.get("/students/create-event", (req, res) => {
    res.render("create-event");
});

app.post("/students/create-event", (req, res) => {
    const { eventName, eventDescription, startDate, endDate, eventRoom, budget } = req.body;

    if (req.isAuthenticated()) {
        const userId = req.user.user_id;

        pool.query(`SELECT * FROM club_coordinator WHERE user_id = $1 `, [userId], (err, results) => {
            if (err) {
                console.log(err);
            }
            else {
                if (results.rows.length > 0) {
                    const clubId = results.rows[0].club_id;
                    pool.query(
                        `INSERT INTO create_events (club_id, event_name, start_date, end_date, event_desc, room, budget) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING event_id`,
                        [clubId, eventName, startDate, endDate, eventDescription, eventRoom, budget],
                        (err) => {
                            if (err) {
                                console.log(err);
                                req.flash("error_msg", "Failed to create the event");
                                res.redirect("/students/create-event");
                            } else {
                                req.flash("success_msg", "Event created.");
                                res.redirect("/students/dashboard");
                            }
                        }
                    );
                }
            }
        })
    }
});

app.post("/students/dashboard/event-register/:userId", (req, res) => {
    const userId = req.params.userId;
    const selectedEventIds = req.body.eventIds;

    if (!selectedEventIds || !Array.isArray(selectedEventIds)) {
        console.error('Invalid or missing eventIds:', selectedEventIds);
        return res.redirect("/students/dashboard");
    }


    const promises = selectedEventIds.map((eventId) => {
        return new Promise((resolve, reject) => {
            pool.query(`INSERT INTO registered_students (event_id, user_id) VALUES ($1, $2)`, [eventId, userId], (err) => {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    console.log("Event registered:", eventId);
                    resolve();
                }
            });
        });
    });


    Promise.all(promises)
        .then(() => {
            res.redirect("/students/dashboard");
        })
        .catch((error) => {
            console.error('Error registering events:', error);
            res.redirect("/students/dashboard");
        });
});


app.post("/students/dashboard/event-unregister/:userId", (req, res) => {
    const userId = req.params.userId;
    const selectedEventIds = req.body.eventIds;

    if (!selectedEventIds || !Array.isArray(selectedEventIds)) {
        console.error('Invalid or missing eventIds:', selectedEventIds);
        return res.redirect("/students/dashboard");
    }


    const promises = selectedEventIds.map((eventId) => {
        return new Promise((resolve, reject) => {
            pool.query(`DELETE FROM registered_students WHERE event_id = $1 AND user_id = $2`, [eventId, userId], (err) => {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    console.log("Event unregistered:", eventId);
                    resolve();
                }
            });
        });
    });


    Promise.all(promises)
        .then(() => {
            res.redirect("/students/dashboard");
        })
        .catch((error) => {
            console.error('Error unregistering events:', error);
            res.redirect("/students/dashboard");
        });
});


app.post("/students/dashboard/request-response/:eventID", (req, res) => {
    const eventId = req.params.eventID;
    const action = req.body.action;

    if (action === "approve") {
        pool.query(`UPDATE create_events SET status = true WHERE event_id = $1`, [eventId], (err) => {
            if (err) {
                console.log(err);
            }
            else {
                req.flash("success_msg", "Request approved successfully");
                res.redirect("/students/dashboard");
                console.log("Success")
            }
        });
    }
    else if (action === "reject") {
        pool.query(`UPDATE create_events SET status = false WHERE event_id = $1`, [eventId], (err) => {
            if (err) {
                console.log(err);
            }
            else {
                req.flash("success_msg", "Request rejected successfully");
                res.redirect("/students/dashboard");
            }
        });
    }
});


app.listen(PORT, () => {
    console.log('Server is working on the port', PORT);
});