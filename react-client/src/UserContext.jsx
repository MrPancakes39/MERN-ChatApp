import { useState, useEffect, createContext } from "react";
import axios from "axios"; //axios is a promise-based, async and await for more readable asynchronous code 

export const UserContext = createContext({});

export function UserContextProvider({ children }) {
    const [username, setUsername] = useState(null);
    const [id, setId] = useState(null);

    useEffect(() => { //fetch users info 
        axios.get('http://localhost:4040/profile').then(response => {
            setId(response.data.userId);
            setUsername(response.data.username);
        }).catch((error)=>{
            console.log("Error Getting Profile");
        });
    }, []);
    return (
        <UserContext.Provider value={{ username, setUsername, id, setId }}>{children} </UserContext.Provider>
    );
}
