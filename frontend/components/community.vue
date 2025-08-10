<script setup>
</script>
<template>
    <div class="flex flex-col pb-10">
        <div class="w-full h-full mt-10">
            <h1 class="text-primary-blue-100 text-center font-bold">
                Join Our Community
            </h1>
        </div>
        <div class="flex flex-col mb-10 lg:hidden">
            <div class="flex flex-row justify-center mt-10 cursor-pointer" @click="openGithub()">
                <div class="w-3/4 flex flex-col bg-primary-blue-100 p-5">
                    <font-awesome icon="fab fa-github-square" class="text-9xl text-white"/>
                    <div class="text-3xl font-bold text-white text-center mt-5">
                        Github
                    </div>
                    <div class="text-xl text-white text-center mt-5">
                        Report bugs, request features and contribute to the project.
                    </div>
                </div>
            </div>

            <div class="flex flex-row justify-center mt-10 cursor-pointer" @click="openLinkedin()">
                <div class="w-3/4 flex flex-col bg-primary-blue-100 p-5">
                    <font-awesome icon="fab fa-linkedin" class="text-9xl text-white"/>
                    <div class="text-3xl font-bold text-white text-center mt-5">
                        Linkedin
                    </div>
                    <div class="text-xl text-white text-center mt-5">
                        Stay updated with tips, announcements, and general information.
                    </div>
                </div>
            </div>
        </div>
        <div class="hidden lg:flex lg:flex-row lg:justify-center lg:mb-10">
            <div class="w-1/4 flex flex-col mt-20 bg-primary-blue-100 hover:bg-primary-blue-200 p-5 mr-10 cursor-pointer" @click="openGithub()">
                <font-awesome icon="fab fa-github-square" class="text-9xl text-white"/>
                <div class="text-3xl font-bold text-white text-center mt-5">
                    Github
                </div>
                <div class="text-xl text-white text-center mt-5">
                    Report bugs, request features and contribute to the project.
                </div>
            </div>
            <div class="w-1/4 flex flex-col mt-20 bg-primary-blue-100 hover:bg-primary-blue-200 p-5 cursor-pointer" @click="openLinkedin()">
                <font-awesome icon="fab fa-linkedin" class="text-9xl text-white"/>
                <div class="text-3xl font-bold text-white text-center mt-5">
                    Linkedin
                </div>
                <div class="text-xl text-white text-center mt-5">
                    Stay updated with tips, announcements, and general information.
                </div>
            </div>
        </div>
    </div>
</template>