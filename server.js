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

app.get("/students/create-clubs", (req, res) => {
    res.render("create-clubs");
});


app.get("/students/login", checkAuthenticated, (req, res) => {
    res.render("login");
});

// app.get("/students/dashboard", (req, res) => {

//     const userRole = req.user.role;
//     const userId = req.user.user_id;
    

//     pool.query(
//         `SELECT * FROM users WHERE role = 2`,
//         (err, stud) => {
//             if (err) {
//                 console.log(err);
//                 req.flash("error_msg", "Failed to fetch students");
//                 res.redirect("/students/dashboard");
//             } 
//             else {
//                 if (userRole === 0) {
//                     pool.query(
//                         `SELECT ClubTable.club_id, ClubTable.name
//                          FROM ClubTable
//                          INNER JOIN Club_coordinator ON ClubTable.club_id = Club_coordinator.club_id
//                          WHERE Club_coordinator.user_id = $1`,
//                         [userId],
//                         (err, clubResults) => {
//                             if (err) {
//                                 console.log(err);
//                                 req.flash("error_msg", "Failed to fetch club data");
//                             }
//                             res.render("admin-dashboard", { user: req.user.name, students: stud.rows});
//                         }
//                     );
//                 }  
//                 else if (userRole === 1) {
//                     res.render("coordinator-dashboard", { user: req.user.name });
//                 } 
//                 else {
//                     res.render("student-dashboard", { user: req.user.name });
//                 }
//                 console.log(stud.rows);
//             }
//         }
//     );
   
// });

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

    pool.query(
        `SELECT * FROM users WHERE role = 2`,
        (err, stud) => {
            if (err) {
                console.log(err);
                req.flash("error_msg", "Failed to fetch students");
                return res.redirect("/students/dashboard");
            } else {
                if (userRole === 0) {
                    // pool.query(
                    //     `SELECT clubTable.club_id, clubTable.name
                    //      FROM clubTable
                    //      INNER JOIN club_coordinator ON clubTable.club_id = club_coordinator.club_id
                    //      WHERE club_coordinator.user_id = $1`,
                    //     [userId],
                    //     (err, clubResults) => {
                    //         if (err) {
                    //             console.log(err);
                    //             req.flash("error_msg", "Failed to fetch club data");
                    //             return res.redirect("/students/dashboard");
                    //         }
                    //         res.render("admin-dashboard", {
                    //             user: req.user.name,
                    //             students: stud.rows,
                    //             clubs: clubResults.rows,
                    //         });
                    //     }
                    // );

                //     pool.query(
                //     `SELECT club_table.club_id, club_table.name AS club_name, users.name AS coordinator_name
                //     FROM club_table
                //     LEFT JOIN club_coordinator ON club_table.club_id = club_coordinator.club_id
                //     LEFT JOIN users ON club_coordinator.user_id = users.user_id`,
                //     (err, results) => {
                //         if (err) {
                //             console.log(err);
                //             req.flash("error_msg", "Failed to fetch club data");
                //         }
                //         res.render("admin-dashboard", {
                //             user: req.user.name,
                //             students: stud.rows,
                //             clubs: results.rows
                //         });
                //     }
                // );

                // pool.query(
                //     `SELECT club_table.club_id, club_table.name AS club_name, users.name AS coordinator_name
                //     FROM club_table
                //     LEFT JOIN club_coordinator ON club_table.club_id = club_coordinator.club_id
                //     LEFT JOIN users ON club_coordinator.user_id = users.user_id`,
                //     (err, results) => {
                //         if (err) {
                //             console.log(err);
                //             req.flash("error_msg", "Failed to fetch club data");
                //         }
                
                //         // Group the clubs and their coordinators
                //         // const clubsData = groupClubsAndCoordinators(results.rows);
                
                //         res.render("admin-dashboard", {
                //             user: req.user.name,
                //             students: stud.rows,
                //             clubs: results.rows,
                //         });
                //     }
                // );

                // pool.query(
                //     `SELECT club_table.club_id, club_table.name AS club_name, users.name AS coordinator_name
                //     FROM club_table
                //     LEFT JOIN club_coordinator ON club_table.club_id = club_coordinator.club_id
                //     LEFT JOIN users ON club_coordinator.user_id = users.user_id`,
                //     (err, results) => {
                //         if (err) {
                //             console.log(err);
                //             req.flash("error_msg", "Failed to fetch club data");
                //         }

                //         // Group the clubs and their coordinators
                //         const clubsData = groupClubsAndCoordinators(results.rows);

                //         // Fetch clubs without coordinators
                //         pool.query(
                //             `SELECT club_table.club_id, club_table.name AS club_name
                //             FROM club_table
                //             WHERE club_table.club_id NOT IN (
                //                 SELECT club_id FROM club_coordinator
                //             )`,
                //             (err, clubsWithoutCoordinators) => {
                //                 if (err) {
                //                     console.log(err);
                //                     req.flash("error_msg", "Failed to fetch clubs without coordinators");
                //                 }

                //                 res.render("admin-dashboard", {
                //                     user: req.user.name,
                //                     students: stud.rows,
                //                     clubs: clubsData,
                //                     clubsWithoutCoordinators: clubsWithoutCoordinators.rows,
                //                 });
                //             }
                //         );
                //     }
                // );
                
                // pool.query(
                //     `SELECT *
                //      FROM create_events
                //      WHERE status IS NULL`,
                //     [userId],
                //     (err, events) => {
                //         if (err) {
                //             console.log(err);
                //             req.flash("error_msg", "Failed to fetch events");
                //             res.redirect("/students/dashboard");
                //         } else {
                //             // res.render("admin-dashboard", {});
                //             pool.query(
                //                 `SELECT club_table.club_id, club_table.name AS club_name, users.name AS coordinator_name
                //                 FROM club_table
                //                 LEFT JOIN club_coordinator ON club_table.club_id = club_coordinator.club_id
                //                 LEFT JOIN users ON club_coordinator.user_id = users.user_id`,
                //                 (err, results) => {
                //                     if (err) {
                //                         console.log(err);
                //                         req.flash("error_msg", "Failed to fetch club data");
                //                     }
            
                //                     // Group the clubs and their coordinators
                //                     const clubsData = groupClubsAndCoordinators(results.rows);
            
                //                     // Fetch clubs without coordinators
                //                     pool.query(
                //                         `SELECT club_table.club_id, club_table.name AS club_name
                //                         FROM club_table
                //                         WHERE club_table.club_id NOT IN (
                //                             SELECT club_id FROM club_coordinator
                //                         )`,
                //                         (err, clubsWithoutCoordinators) => {
                //                             if (err) {
                //                                 console.log(err);
                //                                 req.flash("error_msg", "Failed to fetch clubs without coordinators");
                //                             }
            
                //                             res.render("admin-dashboard", {
                //                                 user: req.user.name,
                //                                 students: stud.rows,
                //                                 clubs: clubsData,
                //                                 clubsWithoutCoordinators: clubsWithoutCoordinators.rows,
                //                                 events: events.rows, 
                //                             });
                //                         }
                //                     );
                //                 }
                //             );
                //         }
                //     }
                // );

                pool.query(
                    `SELECT *
                     FROM create_events
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
                
                                    // Group the clubs and their coordinators
                                    const clubsData = groupClubsAndCoordinators(results.rows);
                
                                    // Fetch clubs without coordinators
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
                
                                            res.render("admin-dashboard", {
                                                user: req.user.name,
                                                students: stud.rows,
                                                clubs: clubsData,
                                                clubsWithoutCoordinators: clubsWithoutCoordinators.rows,
                                                events: events.rows,
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    }
                );
                
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
                                res.render("coordinator-dashboard", { user: req.user.name, events: events.rows });
                            }
                        }
                    );
                    
                    // res.render("coordinator-dashboard", { user: req.user.name });

                } else {
                    
                    pool.query(
                        `SELECT event_id, event_name, start_date, end_date
                         FROM create_events WHERE status = true`,
                        (err, events) => {
                            if (err) {
                                console.log(err);
                                req.flash("error_msg", "Failed to fetch events");
                                res.redirect("/students/dashboard");
                            } else {
                                console.log("Fetched events:", events.rows);
                                res.render("student-dashboard", { user: req.user.name, events: events.rows });
                                
                            }
                        }
                    );
                    
                    // res.render("student-dashboard", { user: req.user.name });
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

app.post("/students/create-clubs",(req, res) => {
    const { clubname } = req.body;
    console.log("Club Name:", clubname);

    if (!clubname) {
        // Handle the case where clubname is missing or empty.
        console.error("error_msg", "Club name is required");
        return res.redirect("/students/create-clubs");
    }
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
                    `INSERT INTO club_coordinator (club_id) VALUES ($1)`,
                    [clubId],
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


// app.post("/students/dashboard/promote-coordinator/:userId", (req, res) => {
//     const { userId } = req.params;

//     pool.query(
//         `UPDATE users SET role = 1 WHERE user_id = $1`,
//         [userId],
//         (err) => {
//             if (err) {
//                 console.log(err);
//                 req.flash("error_msg", "Failed to promote user to coordinator");
//             } else {
//                 req.flash("success_msg", "User promoted to coordinator successfully");
//             }
//             res.redirect("/students/dashboard");
//         }
//     );
// });


app.post("/students/dashboard/promote-coordinator/:userId", (req, res) => {
    const { userId } = req.params;
    const { clubId } = req.body;

    // First, update the user's role to coordinator (role = 1)
    // pool.query(
    //     `UPDATE users SET role = 1 WHERE user_id = $1`,
    //     [userId],
    //     (err) => {
    //         if (err) {
    //             console.log(err);
    //             req.flash("error_msg", "Failed to promote user to coordinator");
    //             res.redirect("/students/dashboard");
    //         } else {
    //             // Next, assign the user to the selected club in the Club_coordinator table
    //             pool.query(
    //                 `INSERT INTO club_coordinator (club_id, user_id) VALUES ($1, $2)`,
    //                 [clubId, userId],
    //                 (err) => {
    //                     if (err) {
    //                         console.log(err);
    //                         req.flash("error_msg", "Failed to assign coordinator to the club");
    //                     } else {
    //                         req.flash("success_msg", "User promoted to coordinator and assigned to the club successfully");
    //                     }
    //                     res.redirect("/students/dashboard");
    //                 }
    //             );
    //         }
    //     }
    // );

    pool.query(
        `UPDATE users SET role = 1 WHERE user_id = $1`,
        [userId],
        (err) => {
            if (err) {
                console.log(err);
                req.flash("error_msg", "Failed to promote user to coordinator");
                res.redirect("/students/dashboard");
            } else {
                // Next, check if the user is already assigned to the club in the Club_coordinator table
                pool.query(
                    `SELECT * FROM club_coordinator WHERE club_id = $1 AND user_id = $2`,
                    [clubId, userId],
                    (err, results) => {
                        if (err) {
                            console.log(err);
                            req.flash("error_msg", "Failed to check coordinator assignment");
                            res.redirect("/students/dashboard");
                        } else if (results.rows.length === 0) {
                            // If the user is not assigned to the club, insert the assignment
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
                        } else {
                            // The user is already assigned to the club, no need to insert again
                            req.flash("success_msg", "User promoted to coordinator successfully");
                            res.redirect("/students/dashboard");
                        }
                    }
                );
            }
        }
    );
});

// app.get("/students/create-event", (req, res) => {
//     res.render("create-event");
// });

// app.post("/students/create-event", (req, res) => {
//     const { clubId, eventName, startDate, endDate } = req.body;

//     pool.query(
//         `INSERT INTO create_events (club_id, event_name, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING event_id`,
//         [clubId, eventName, startDate, endDate],
//         (err, eventResult) => {
//             if (err) {
//                 console.log(err);
//                 req.flash("error_msg", "Failed to create the event");
//                 res.redirect("/students/create-event");
//             } else {
//                 req.flash("success_msg", "Event created.");
//                 res.redirect("/students/dashboard");
//             }
//         }
//     );
// });

app.get("/students/create-event", (req, res) => {
    res.render("create-event");
});

app.post("/students/create-event", (req, res) => {
    const { eventName, eventDescription, startDate, endDate, eventRoom, budget } = req.body;
    
    if (req.isAuthenticated()) {
        const userId = req.user.user_id;
    

        pool.query(`SELECT * FROM club_coordinator WHERE user_id = $1 `, [userId], (err, results) => {
            if(err){
                console.log(err);
            }
            else{
                if (results.rows.length > 0) {
                    const clubId = results.rows[0].club_id;
                    pool.query(
                        `INSERT INTO create_events (club_id, event_name, start_date, end_date, event_desc, room, budget) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING event_id`,
                        [clubId, eventName, startDate, endDate, eventDescription, eventRoom, budget],
                        (err, eventResult) => {
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


// // Add a route to list events for a coordinator
// app.get("/students/list-events", checkAuthenticated, checkCoordinator, (req, res) => {
//     const coordinatorId = req.user.user_id;

//     // Fetch events associated with the coordinator's club
//     pool.query(
//         `SELECT event_id, event_name, start_date, end_date
//          FROM create_events
//          WHERE club_id = (SELECT club_id FROM club_coordinator WHERE user_id = $1)`,
//         [coordinatorId],
//         (err, events) => {
//             if (err) {
//                 console.log(err);
//                 req.flash("error_msg", "Failed to fetch events");
//                 res.redirect("/students/dashboard");
//             } else {
//                 res.render("list-events", { events: events.rows });
//             }
//         }
//     );
// });

// function checkCoordinator(req, res, next) {
//     if (req.user.role === 1) {
//         return next();
//     } else {
//         req.flash("error_msg", "Access denied. Coordinator privileges required.");
//         return res.redirect("/students/dashboard");
//     }
// }

app.post("/students/dashboard/request-response/:eventID", (req, res) => {
    const eventId = req.params.eventID;
    const action = req.body.action;

    if(action === "approve"){
        pool.query(`UPDATE create_events SET status = true WHERE event_id = $1`, [eventId], (err) => {
            if(err){
                console.log(err);
            }
            else{
                req.flash("success_msg", "Request approved successfully");
                res.redirect("/students/dashboard");
                console.log("Success")
            }
        });
    }
    else if(action === "reject"){
        pool.query(`UPDATE create_events SET status = false WHERE event_id = $1`, [eventId], (err) => {
            if(err){
                console.log(err);
            }
            else{
                req.flash("success_msg", "Request rejected successfully");
                res.redirect("/students/dashboard");
            }
        });
    }
});


app.listen(PORT, () => {
    console.log('Server is working on the port', PORT);
});