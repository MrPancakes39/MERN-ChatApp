import { useState, useContext } from "react";
import { UserContext } from "./UserContext";
import axios from "axios";

export default function RegisterAndLoginForm(ev) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { setUsername: setLoggedInUsername, setId } = useContext(UserContext);
    const [isLoginOrRegister, setLoginOrRegister] = useState('register'); //to change the button whether logged in or register once the button is clicked
    
    function handleSubmit(event) {
        event.preventDefault();
        const URL = `http://localhost:4040/${isLoginOrRegister}`;
        axios.post(URL, { username, password })
        .then((response) => {
            console.log(response);
            const {data} = response;
            setLoggedInUsername(username);
            setId(data.id);
        })
        .catch(function (error) {
            if (error.response) {
                console.log("Error");
                console.log(error.response.data);
                console.log(error.response.status);
                console.log(error.response.headers);
            }
            throw error;
        });
    }

    return (
        <div className="bg-blue-50 h-screen flex items-center">
            <form className="w-64 mx-auto mb-12" onSubmit={handleSubmit}>
                <input value={username}
                    onChange={ev => setUsername(ev.target.value)}
                    type="text" placeholder="username"
                    className="block w-full rounded-sm p-2 mb-2 border" />
                <input value={password}
                    onChange={ev => setPassword(ev.target.value)}
                    type="password" placeholder="password"
                    className="block w-full rounded-sm p-2 mb-2 border" />
                <button className="bg-blue-500 text-white block w-full rounded-sn p-2">
                    {isLoginOrRegister === 'register' ? 'Register' : 'Login'}
                </button>
                <div className="text-center mt-2">

                    {isLoginOrRegister === 'register' && (
                        <div>
                            Already a member?
                            <button onClick={() => setLoginOrRegister('login')}>
                                Login here
                            </button>
                        </div>
                    )}
                    {isLoginOrRegister === 'login' && (
                        <div>
                            Don't have an account?
                            <button className="ml-1" onClick={() => setLoginOrRegister('register')}>
                                Register
                            </button>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}