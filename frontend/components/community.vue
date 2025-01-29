<script setup>
const { openGithub, openLinkedin } = Utils();

</script>
<template>
    <div class="flex flex-col">
        <img src="/blue-background-top.svg" class="w-full" />
        <div class="bg-primary-blue-100 w-full h-[600px]">
            <div class="text-4xl text-white text-center font-bold mt-10">
                Join Our Community
            </div>
            <div class="flex flex-row justify-between">
                <div class="w-1/2 flex flex-col mt-20 cursor-pointer" @click="openGithub()">
                    <div class="flex flex-row bg-white w-3/4 h-full p-10 ml-10 justify-center items-center">
                        <div class="flex flex-col">
                            <font-awesome icon="fab fa-github-square" class="text-9xl text-primary-blue-100"/>
                            <div class="text-3xl font-bold text-primary-blue-100 text-center mt-5">
                                Github
                            </div>
                            <div class="text-xl font-bold text-primary-blue-100 text-center mt-5">
                                Report bugs, request features and contribute to the project.
                            </div>
                        </div>

                    </div>
                </div>
                <div class="w-1/2 flex flex-col mt-20 cursor-pointer" @click="openLinkedin()">
                    <div class="flex flex-row bg-white w-3/4 h-full p-10 ml-10 justify-center items-center">
                        <div class="flex flex-col">
                            <font-awesome icon="fab fa-linkedin" class="text-9xl text-primary-blue-100"/>
                            <div class="text-3xl font-bold text-primary-blue-100 text-center mt-5">
                                Linkedin
                            </div>
                            <div class="text-xl font-bold text-primary-blue-100 text-center mt-5">
                                Stay updated with tips, announcements, and general information.
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
        <img src="/blue-background-bottom.svg" class="w-full" />
    </div>
</template>