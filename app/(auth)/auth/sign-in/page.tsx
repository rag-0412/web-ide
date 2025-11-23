import SignInFormClient from '@/features/auth/components/sign-in-form-client'
import Image from 'next/image'
import React from 'react'

const SignInPage = () => {
  return (
    <>
        <Image 
          src="/login.svg" 
          alt="Login-Image" 
          width={300}
          height={300}
          className='m-6 object-cover'
          priority
        />
        <SignInFormClient/>
    </>
  )
}

export default SignInPage