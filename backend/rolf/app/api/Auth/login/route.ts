import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../_utils/cors";
import {prisma} from "@/lib/prisma"
import bcrypt from "bcrypt";
import crypto from "crypto";


export async function OPTIONS(req : NextRequest){
    const origin = req.headers.get("origin");
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(origin),
    });
}


export async function POST(req:NextRequest ){
    const origin = req.headers.get("origin");
    const headers = corsHeaders(origin);
    try{
        const body = await req.json(); // Parses the JSON you sent from frontend
        const UID = body.UID?.toString().trim();
        const PWD = body.PWD?.toString().trim()
        if(!PWD || !UID ){
            return NextResponse.json(
                {error: "Missing Required Feilds UID or PWD"},
            {status: 400, headers});
        }
        const Auth = await prisma.user.findFirst({
            where : {
                OR: [
                    {username: UID},
                    {email: UID}
                ]
            }
        })
        if(!Auth){
            return NextResponse.json(
                {error: "Invalid Credentials" },
            {status: 401, headers});
        }

        // Check PWD
        const valid = await bcrypt.compare(PWD,Auth.password);
        if(!valid){
            return NextResponse.json(
                
                {error: "Invalid Credentials"},
                {status: 401, headers},                
            );
        }
        // Session Tokens
         const sessionToken = crypto.randomBytes(32).toString("hex");
         const expires = new Date(Date.now() + 8 * 60 * 60 * 1000);
            
        await prisma.session.create({
        data: {
            token: sessionToken,
            userId: Auth.id,
            expires,
        },
        });

        const response = NextResponse.json(
        {
            message: "Auth Success",
            user: {
            id: Auth.id,
            username: Auth.username,
            role: Auth.role,
            },
        },
        { status: 200, headers }
        );

        // 2. Set as a Session Cookie (Remove 'expires' here to clear on browser close)
        response.cookies.set("session", sessionToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production", 
        path: "/",
        });

        // 3. IMPORTANT: Return the response!
        return response;

    }catch(err){
        return NextResponse.json({error: "Internal Error"},
            {status: 500, headers});
    }

}