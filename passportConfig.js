const LocalStrategy = require("passport-local").Strategy;
const { authenticate } = require("passport");
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");


function initialize(passport) {
    const authenticateUser = (rollnumber, password, done) => {
        pool.query(
            `SELECT * FROM students WHERE rollnumber = $1`, [rollnumber], (err, results) => {
                if (err) {
                    throw err;
                }

                console.log(results.rows);

                if (results.rows.length > 0) {
                    const user = results.rows[0];

                    bcrypt.compare(password, user.password, (err, isMatch) => {
                        if (err) {
                            throw err;
                        }

                        if (isMatch) {
                            return done(null, user);
                        } else {
                            return done(null, false, { message: "Incorrect Password" });
                        }
                    })
                } else {
                    return done(null, false, { message: "You haven't already registered" });
                }
            }
        )
    }
    passport.use(
        new LocalStrategy(
            {
                usernameField: "rollnumber",
                passwordField: "password"
            },
            authenticateUser
        )
    );

    passport.serializeUser((students, done) => done(null, students.rollnumber));

    passport.deserializeUser((rollnumber, done) => {
        pool.query(`SELECT * FROM students WHERE rollnumber = $1`, [rollnumber], (err, results) => {
            if (err) {
                throw err;
            }
            return done(null, results.rows[0]);
        });
    });
}

module.exports = initialize;