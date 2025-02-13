<script setup>
const { openGithub, openLinkedin } = Utils();

</script>
<template>
    <div class="flex flex-col">
        <div class="w-full h-full mt-10">
            <div class="text-4xl text-black text-center font-bold">
                Join Our Community
            </div>
        </div>
        <div class="flex flex-col mb-10 lg:hidden">
            <div class="flex flex-row justify-center mt-10 cursor-pointer" @click="openGithub()">
                <div class="w-3/4 flex flex-col bg-primary-blue-100 p-5">
                    <font-awesome icon="fab fa-github-square" class="text-9xl text-white"/>
                    <div class="text-3xl font-bold text-white text-center mt-5">
                        Github
                    </div>
                    <div class="text-xl font-bold text-white text-center mt-5">
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
                    <div class="text-xl font-bold text-white text-center mt-5">
                        Stay updated with tips, announcements, and general information.
                    </div>
                </div>
            </div>
        </div>
        <div class="hidden lg:flex lg:flex-row lg:justify-between lg:mb-10">
            <div class="w-1/2 flex flex-col mt-20 cursor-pointer" @click="openGithub()">
                <div class="flex flex-row bg-primary-blue-100 w-3/4 h-full p-10 ml-10 justify-center items-center">
                    <div class="flex flex-col">
                        <font-awesome icon="fab fa-github-square" class="text-9xl text-white"/>
                        <div class="text-3xl font-bold text-white text-center mt-5">
                            Github
                        </div>
                        <div class="text-xl font-bold text-white text-center mt-5">
                            Report bugs, request features and contribute to the project.
                        </div>
                    </div>
                </div>
            </div>
            <div class="w-1/2 flex flex-col mt-20 cursor-pointer" @click="openLinkedin()">
                <div class="flex flex-row bg-primary-blue-100 w-3/4 h-full p-10 ml-10 justify-center items-center">
                    <div class="flex flex-col">
                        <font-awesome icon="fab fa-linkedin" class="text-9xl text-white"/>
                        <div class="text-3xl font-bold text-white text-center mt-5">
                            Linkedin
                        </div>
                        <div class="text-xl font-bold text-white text-center mt-5">
                            Stay updated with tips, announcements, and general information.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>