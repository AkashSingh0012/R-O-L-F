import { Prisma, PrismaClient } from "@prisma/client"; 
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../_utils/cors";
import bcrypt from "bcrypt";
import crypto from "crypto";
const prisma = new PrismaClient()

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
    const error_drop = [];
    try{
        const formData = await req.formData();
        const UID = formData.get("UID")?.toString().trim();
        const PWD = formData.get("PWD")?.toString().trim();
        if(!PWD || !UID ){
            error_drop.push("Missing Required Fields");
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

    const expires = new Date();
    expires.setDate(expires.getHours()+8);//8 Hours session Expires 

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
    
    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: false, // change to true in production
      expires,
      path: "/",
    });

    }catch(err){
        error_drop.push(err)
        console.log(error_drop)
        return NextResponse.json({error: "Internal Error"},
            {status: 500, headers});
    }

}