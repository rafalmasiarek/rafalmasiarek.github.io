#!/bin/bash

set -o nounset
set -o errexit
set -o xtrace

# Set the name of the folder that will be created in the parent
# folder of your repo folder, and which will temporarily
# hold the generated content.
temp_folder=$(mktemp -d -t _gh-pages-temp-XXXXXXXXXX)

# Make sure our main code runs only if we push the master branch
if [ "$CIRCLE_BRANCH" == "master" ]; then

    git config credential.helper 'cache --timeout=120'
    git config user.email "${GITHUB_EMAIL}"
    git config user.name "${GITHUB_USERNAME}"

	# Store the last commit message from master branch
	last_message=$(git show -s --format=%s $CIRCLE_BRANCH)

	# Move the generated site in our temp folder
	mv _site ${temp_folder}

	# Checkout the gh-pages branch and clean it's contents
	git show-branch gh-pages &>/dev/null && git checkout gh-pages || git checkout -b gh-pages
	rm -rf *

	# Copy the site content from the temp folder and remove the temp folder
	rsync -avz ${temp_folder}/_site/ ./

	rm -rf ${temp_folder}

    # Add custom domain
	if [ ! -z "${GITHUB_CUSTOM_DOMAINS}" ]; then
	    echo -ne "${GITHUB_CUSTOM_DOMAINS}" > ./CNAME
	fi

	# Commit and push our generated site to GitHub
	git add -A
	git commit --allow-empty -m "Page release ${CIRCLE_BUILD_NUM} from ${CIRCLE_BRANCH}" -m "$last_message"
	git push -q --force https://${GITHUB_TOKEN}@github.com/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}.git gh-pages:gh-pages
	git tag -a "release_branch-${CIRCLE_BRANCH}_build-${CIRCLE_BUILD_NUM}" -m "Release based on build ${CIRCLE_BUILD_NUM}" -m "Build on ${CIRCLE_BUILD_URL}"
	git push -q --tags https://${GITHUB_TOKEN}@github.com/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}.git

	# Go back to the master branch
	git checkout $CIRCLE_BRANCH
else
	echo "Not master branch. Skipping build"
fi